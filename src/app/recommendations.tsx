"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import type { HardwareFormValues } from "@/application/hardware";
import { parseHardwareForm } from "@/application/hardware";
import {
  recommendModels,
  type RecommendationSet,
} from "@/application/recommendations";
import type { GpuDefinition, ModelDefinition } from "@/domain/types";
import { HardwareFields } from "./hardware-fields";
import { ContextGuidanceView } from "./context-guidance";

interface RecommendationsProps {
  models: readonly ModelDefinition[];
  gpus: readonly GpuDefinition[];
}

const defaultValues: HardwareFormValues = {
  cpuName: "My CPU",
  gpuId: "none",
  vramGiB: "0",
  systemRamGiB: "16",
  operatingSystem: "windows",
};

export function Recommendations({ models, gpus }: RecommendationsProps) {
  const [values, setValues] = useState<HardwareFormValues>(defaultValues);
  const [formState, setFormState] = useState<{
    fieldErrors: Record<string, string>;
    formError?: string;
  }>({ fieldErrors: {} });
  const [recommendationSet, setRecommendationSet] =
    useState<RecommendationSet>();

  function updateValue(field: keyof HardwareFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFormState({ fieldErrors: {} });
    setRecommendationSet(undefined);
  }

  function handleGpuChange(gpuId: string) {
    const gpu = gpus.find((candidate) => candidate.id === gpuId);
    setValues((current) => ({
      ...current,
      gpuId,
      vramGiB: gpu?.vramGiB.toString() ?? "0",
    }));
    setFormState({ fieldErrors: {} });
    setRecommendationSet(undefined);
  }

  function applyDetected(patch: Partial<HardwareFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
    setFormState({ fieldErrors: {} });
    setRecommendationSet(undefined);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseHardwareForm(values);
    if (!parsed.hardware) {
      setFormState({
        fieldErrors: parsed.fieldErrors,
        formError: parsed.formError,
      });
      setRecommendationSet(undefined);
      return;
    }
    setFormState({ fieldErrors: {} });
    setRecommendationSet(recommendModels(parsed.hardware, models));
  }

  return (
    <main className="shell recommendations-page">
      <header className="hero">
        <p className="eyebrow">LLMGauge · hardware recommendations</p>
        <h1>What can your PC run?</h1>
        <p className="lede">
          Enter your hardware once and compare the local models that fit the
          current catalog’s transparent memory estimates.
        </p>
        <nav className="page-nav" aria-label="Primary navigation">
          <Link href="/">Evaluate one model</Link>
          <Link href="/guides">Learn the basics</Link>
        </nav>
      </header>
      <div className="recommendations-layout">
        <form className="calculator-card" onSubmit={handleSubmit} noValidate>
          <section
            className="form-section"
            aria-labelledby="recommendation-hardware-heading"
          >
            <div className="section-heading">
              <p className="section-number">01</p>
              <div>
                <h2 id="recommendation-hardware-heading">
                  Describe your hardware
                </h2>
                <p>
                  Use the same hardware inputs as the single-model calculator.
                </p>
              </div>
            </div>
            <HardwareFields
              values={values}
              gpus={gpus}
              fieldErrors={formState.fieldErrors}
              onChange={updateValue}
              onGpuChange={handleGpuChange}
              onApplyDetected={applyDetected}
            />
          </section>
          <button className="evaluate-button" type="submit">
            Find suitable models <span aria-hidden="true">→</span>
          </button>
          {formState.formError && (
            <p className="form-error" role="alert">
              {formState.formError}
            </p>
          )}
        </form>
        <RecommendationResults recommendationSet={recommendationSet} />
      </div>
    </main>
  );
}

function RecommendationResults({
  recommendationSet,
}: {
  recommendationSet?: RecommendationSet;
}) {
  if (!recommendationSet) {
    return (
      <aside className="result-card empty-result" aria-live="polite">
        <p className="result-kicker">Recommendations</p>
        <h2>Ready when you are.</h2>
        <p>
          Submit your hardware profile to see which models and quantizations are
          suitable.
        </p>
      </aside>
    );
  }
  return (
    <section
      className="recommendation-results"
      aria-live="polite"
      aria-atomic="true"
      aria-labelledby="recommendations-heading"
    >
      <div className="results-heading">
        <div>
          <p className="result-kicker">Recommendations</p>
          <h2 id="recommendations-heading">Models for your hardware</h2>
        </div>
        <span className="result-count">
          {recommendationSet.recommendations.length} suitable
        </span>
      </div>
      {recommendationSet.recommendations.length ? (
        <div className="recommendation-list">
          {recommendationSet.recommendations.map((entry) => (
            <RecommendationCard
              key={`${entry.model.id}-${entry.quantization.id}`}
              entry={entry}
            />
          ))}
        </div>
      ) : (
        <div className="no-results">
          <h3>No suitable model found</h3>
          <p>
            The current catalog has no candidate that fits this hardware under
            the approximate memory assumptions.
          </p>
        </div>
      )}
      {recommendationSet.unsuitable.length > 0 && (
        <details className="unsuitable-section">
          <summary>
            Show {recommendationSet.unsuitable.length} not-suitable candidate
            {recommendationSet.unsuitable.length === 1 ? "" : "s"}
          </summary>
          <div className="recommendation-list">
            {recommendationSet.unsuitable.map((entry) => (
              <RecommendationCard
                key={`${entry.model.id}-${entry.quantization.id}`}
                entry={entry}
              />
            ))}
          </div>
        </details>
      )}
      {recommendationSet.skippedModelIds.length > 0 && (
        <p className="catalog-note">
          Some catalog entries were skipped because their data was incomplete or
          invalid.
        </p>
      )}
    </section>
  );
}

function RecommendationCard({
  entry,
}: {
  entry: import("@/application/recommendations").RecommendationEntry;
}) {
  const result = entry.result;
  return (
    <article className={`recommendation-card result-${result.level}`}>
      <div className="recommendation-card-heading">
        <div>
          <h3>{entry.model.displayName}</h3>
          <p>
            {entry.model.provider} · {entry.quantization.displayName}
          </p>
        </div>
        <span className="level-badge">{labelForLevel(result.level)}</span>
      </div>
      <p className="recommendation-summary">{entry.model.summary}</p>
      <p className="recommendation-explanation">{entry.explanation}</p>
      <ContextGuidanceView
        guidance={result.contextGuidance}
        headingId={`context-guidance-${entry.model.id}-${entry.quantization.id}`}
      />
      <dl className="recommendation-stats">
        <div>
          <dt>Execution</dt>
          <dd>{labelForExecution(result.executionMode)}</dd>
        </div>
        <div>
          <dt>Estimated VRAM (approx.)</dt>
          <dd>{result.memory.estimatedVramGiB} GiB</dd>
        </div>
        <div>
          <dt>Estimated system RAM (approx.)</dt>
          <dd>{result.memory.estimatedSystemRamGiB} GiB</dd>
        </div>
      </dl>
      {result.limitingFactors.length > 0 && (
        <p className="card-limitation">
          <strong>Limitation:</strong> {result.limitingFactors[0]}
        </p>
      )}
      {result.warnings.length > 0 && (
        <p className="card-warning">
          <strong>Note:</strong> {result.warnings[0]}
        </p>
      )}
      <div className="recommendation-links">
        <Link className="details-link" href={`/models/${entry.model.slug}`}>
          Read about this model <span aria-hidden="true">→</span>
        </Link>
        <Link className="details-link" href="/">
          Open the calculator <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

function labelForLevel(level: keyof typeof levelLabels): string {
  return levelLabels[level];
}

const levelLabels = {
  "gpu-capable": "GPU-capable",
  "partial-offload": "Partial offload",
  "cpu-only": "CPU-only",
  unsupported: "Unsupported",
} as const;
const executionLabels = {
  gpu: "Full GPU execution",
  "partial-offload": "Partial GPU offload",
  cpu: "CPU execution",
  unsupported: "Not recommended",
} as const;
function labelForExecution(mode: keyof typeof executionLabels): string {
  return executionLabels[mode];
}
