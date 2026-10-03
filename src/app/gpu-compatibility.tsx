"use client";

import { evaluateGpuCompatibility } from "@/application/gpu-compatibility";
import {
  buildGpuCompatibilitySharePath,
  parseGpuCompatibilityShareParams,
} from "@/application/gpu-compatibility-share";
import type {
  GpuCompatibilityEvaluation,
  GpuCompatibilityFormValues,
} from "@/application/gpu-compatibility";
import type { RuntimeProfileFormValues } from "@/application/hardware";
import type { GpuDefinition, ModelDefinition } from "@/domain/types";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { formatMemoryGiB } from "./format-memory";
import { RuntimeFields } from "./runtime-fields";

interface GpuCompatibilityProps {
  models: readonly ModelDefinition[];
  gpus: readonly GpuDefinition[];
}

const initialValues: GpuCompatibilityFormValues = {
  modelId: "",
  systemRamGiB: "",
  runtime: "",
  backend: "",
  executionPreference: "",
  targetContextLength: "",
};

const levelLabels = {
  "gpu-capable": "GPU-capable",
  "partial-offload": "Partial offload",
  "cpu-only": "CPU-only",
  "unified-memory-fit": "Unified-memory fit",
  unsupported: "Unsupported",
} as const;

export function GpuCompatibility({ models, gpus }: GpuCompatibilityProps) {
  const [values, setValues] = useState(initialValues);
  const [evaluation, setEvaluation] = useState<GpuCompatibilityEvaluation>({
    fieldErrors: {},
  });
  const [search, setSearch] = useState("");
  const [shareError, setShareError] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<{
    status: "success" | "failure";
    message: string;
  } | null>(null);
  const [manualShareLink, setManualShareLink] = useState("");
  const restoredQuery = useRef(false);

  useEffect(() => {
    if (restoredQuery.current) return;
    restoredQuery.current = true;
    const restored = parseGpuCompatibilityShareParams(
      new URLSearchParams(window.location.search),
      models,
    );
    if (restored.status === "invalid") {
      setShareError(restored.message);
      return;
    }
    if (restored.status !== "valid") return;

    const next = evaluateGpuCompatibility(restored.values, models, gpus);
    if (next.groups && Object.keys(next.fieldErrors).length === 0) {
      setValues(restored.values);
      setEvaluation(next);
    } else {
      setShareError(
        "This comparison link could not be evaluated. Enter your comparison manually.",
      );
    }
  }, [gpus, models]);

  function updateValue(
    field: keyof (GpuCompatibilityFormValues & RuntimeProfileFormValues),
    value: string,
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setEvaluation({ fieldErrors: {} });
    setCopyFeedback(null);
    setManualShareLink("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = evaluateGpuCompatibility(values, models, gpus);
    setEvaluation(next);
    setSearch("");
    setCopyFeedback(null);
    setManualShareLink("");
  }

  async function handleCopyComparisonLink() {
    const path = buildGpuCompatibilitySharePath(values, models);
    if (!path) {
      setCopyFeedback({
        status: "failure",
        message: "The comparison values could not be validated. Review the form and try again.",
      });
      return;
    }

    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else if (!copyWithDocumentCommand(url)) {
        throw new Error("Clipboard copy was unavailable.");
      }
      setCopyFeedback({ status: "success", message: "Comparison link copied." });
      setManualShareLink("");
    } catch {
      if (copyWithDocumentCommand(url)) {
        setCopyFeedback({ status: "success", message: "Comparison link copied." });
        setManualShareLink("");
      } else {
        setCopyFeedback({
          status: "failure",
          message: "Copy failed. Select and copy the comparison link below.",
        });
        setManualShareLink(url);
      }
    }
  }

  const groups = evaluation.groups
    ?.map((group) => ({
      ...group,
      entries: group.entries.filter((entry) =>
        `${entry.gpu.displayName} ${entry.gpu.vendor} ${entry.gpu.id}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase().trim()),
      ),
    }))
    .filter((group) => group.entries.length > 0);

  return (
    <main className="shell gpu-compatibility-page">
      <header className="hero">
        <p className="eyebrow">LLMGauge · GPU compatibility</p>
        <h1>Which GPUs can run this model?</h1>
        <p className="lede">
          Choose a catalog model and enter your system RAM to compare its
          catalogued quantizations against discrete GPUs in the LLMGauge
          catalog.
        </p>
      </header>
      <div className="gpu-compatibility-layout">
        <form className="calculator-card" onSubmit={handleSubmit} noValidate>
          <section
            className="form-section"
            aria-labelledby="gpu-compatibility-inputs"
          >
            <div className="section-heading">
              <p className="section-number">01</p>
              <div>
                <h2 id="gpu-compatibility-inputs">
                  Choose a model and enter RAM
                </h2>
                <p>System RAM is held constant across every GPU result.</p>
              </div>
            </div>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="comparison-model">Model</label>
                <select
                  id="comparison-model"
                  value={values.modelId}
                  onChange={(event) =>
                    updateValue("modelId", event.target.value)
                  }
                  aria-invalid={Boolean(evaluation.fieldErrors.modelId)}
                  aria-describedby={
                    evaluation.fieldErrors.modelId
                      ? "comparison-model-error"
                      : "comparison-model-help"
                  }
                >
                  <option value="">Choose a catalog model</option>
                  {models.map((model) => (
                    <option value={model.id} key={model.id}>
                      {model.displayName}
                    </option>
                  ))}
                </select>
                {evaluation.fieldErrors.modelId ? (
                  <p id="comparison-model-error" className="field-error">
                    {evaluation.fieldErrors.modelId}
                  </p>
                ) : (
                  <p id="comparison-model-help" className="field-help">
                    Only models in the curated catalog are available.
                  </p>
                )}
              </div>
              <div className="field">
                <label htmlFor="comparison-system-ram">System RAM (GiB)</label>
                <input
                  id="comparison-system-ram"
                  type="number"
                  min="0.01"
                  step="any"
                  inputMode="decimal"
                  value={values.systemRamGiB}
                  onChange={(event) =>
                    updateValue("systemRamGiB", event.target.value)
                  }
                  aria-invalid={Boolean(evaluation.fieldErrors.systemRamGiB)}
                  aria-describedby={
                    evaluation.fieldErrors.systemRamGiB
                      ? "comparison-system-ram-error"
                      : "comparison-system-ram-help"
                  }
                />
                {evaluation.fieldErrors.systemRamGiB ? (
                  <p id="comparison-system-ram-error" className="field-error">
                    {evaluation.fieldErrors.systemRamGiB}
                  </p>
                ) : (
                  <p id="comparison-system-ram-help" className="field-help">
                    Enter the same available system RAM value for all GPU
                    comparisons.
                  </p>
                )}
              </div>
            </div>
            <RuntimeFields
              values={values}
              fieldErrors={evaluation.fieldErrors}
              onChange={updateValue}
            />
          </section>
          <button className="evaluate-button" type="submit">
            Compare catalog GPUs <span aria-hidden="true">→</span>
          </button>
          {evaluation.formError && (
            <p className="form-error" role="alert">
              {evaluation.formError}
            </p>
          )}
          {shareError && (
            <div className="form-error" role="alert">
              <p>{shareError}</p>
              <button type="button" onClick={() => setShareError("")}>
                Dismiss message
              </button>
            </div>
          )}
          {evaluation.groups && (
            <section className="share-comparison" aria-labelledby="share-comparison-heading">
              <h2 id="share-comparison-heading">Share this comparison</h2>
              <p>
                The link encodes the model, system RAM, and any runtime, backend,
                execution preference, or context target you selected. Anyone who
                has the link can see these values.
              </p>
              <button type="button" onClick={handleCopyComparisonLink}>
                Copy comparison link
              </button>
              {copyFeedback && (
                <p role={copyFeedback.status === "success" ? "status" : "alert"}>
                  {copyFeedback.message}
                </p>
              )}
              {manualShareLink && (
                <div className="field">
                  <label htmlFor="manual-comparison-link">Comparison link</label>
                  <input
                    id="manual-comparison-link"
                    type="url"
                    readOnly
                    value={manualShareLink}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </div>
              )}
            </section>
          )}
        </form>
        <GpuCompatibilityResults
          evaluation={evaluation}
          groups={groups}
          search={search}
          onSearch={setSearch}
        />
      </div>
      <p className="page-note">
        The representative quantization follows LLMGauge’s existing fit and
        metadata policy. It is not a model-quality or performance
        recommendation. Estimates are approximate; see the{" "}
        <Link href="/">single-model calculator</Link> or{" "}
        <Link href="/recommendations">hardware recommendations</Link> for other
        workflows.
      </p>
    </main>
  );
}

function GpuCompatibilityResults({
  evaluation,
  groups,
  search,
  onSearch,
}: {
  evaluation: GpuCompatibilityEvaluation;
  groups?: GpuCompatibilityEvaluation["groups"];
  search: string;
  onSearch: (value: string) => void;
}) {
  if (!evaluation.groups) {
    return (
      <aside className="result-card empty-result" aria-live="polite">
        <p className="result-kicker">GPU comparison</p>
        <h2>Ready when you are.</h2>
        <p>
          Select a model, enter system RAM, and compare all catalogued discrete
          GPUs.
        </p>
      </aside>
    );
  }

  const count =
    groups?.reduce((sum, group) => sum + group.entries.length, 0) ?? 0;
  return (
    <section
      className="gpu-comparison-results"
      aria-live="polite"
      aria-labelledby="gpu-results-heading"
    >
      <div className="results-heading">
        <div>
          <p className="result-kicker">{evaluation.model?.displayName}</p>
          <h2 id="gpu-results-heading">Discrete GPU results</h2>
        </div>
        <span className="result-count">{count} GPUs</span>
      </div>
      <label className="gpu-comparison-search" htmlFor="gpu-comparison-search">
        Filter GPUs
        <input
          id="gpu-comparison-search"
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search by name or vendor"
        />
      </label>
      {count ? (
        groups?.map((group) => (
          <section
            className="gpu-comparison-group"
            key={group.level}
            aria-labelledby={`gpu-group-${group.level}`}
          >
            <h3 id={`gpu-group-${group.level}`}>
              {levelLabels[group.level]} <span>{group.entries.length}</span>
            </h3>
            <div className="gpu-comparison-list">
              {group.entries.map((entry) => {
                const reason =
                  entry.result.limitingFactors[0] ??
                  entry.result.kvCache.reason;
                return (
                  <article className="gpu-comparison-card" key={entry.gpu.id}>
                    <div className="gpu-comparison-card-heading">
                      <div>
                        <p className="result-kicker">
                          {entry.gpu.vendor} ·{" "}
                          {formatMemoryGiB(entry.gpu.vramGiB)} catalogued VRAM
                        </p>
                        <h4>{entry.gpu.displayName}</h4>
                      </div>
                      <span
                        className={`compatibility-badge compatibility-${entry.result.level}`}
                      >
                        {levelLabels[entry.result.level]}
                      </span>
                    </div>
                    <dl className="gpu-comparison-stats">
                      <div>
                        <dt>Representative quantization</dt>
                        <dd>{entry.quantization.displayName}</dd>
                      </div>
                      <div>
                        <dt>Estimated model weights</dt>
                        <dd>
                          {formatMemoryGiB(entry.result.memory.modelWeightsGiB)}
                        </dd>
                      </div>
                      <div>
                        <dt>Estimated VRAM required</dt>
                        <dd>
                          {entry.result.memory.estimatedVramGiB === null
                            ? "Not applicable"
                            : formatMemoryGiB(
                                entry.result.memory.estimatedVramGiB,
                              )}
                        </dd>
                      </div>
                      <div>
                        <dt>Estimated system RAM required</dt>
                        <dd>
                          {formatMemoryGiB(
                            entry.result.memory.estimatedSystemRamGiB,
                          )}
                        </dd>
                      </div>
                    </dl>
                    <p className="gpu-comparison-caveat">{reason}</p>
                    <p className="gpu-comparison-cache">
                      {entry.result.kvCache.reason}
                      {entry.result.kvCache.status === "estimated"
                        ? ` Estimated cache: ${formatMemoryGiB(entry.result.kvCache.sizeGiB!)} (${entry.result.kvCache.placement}).`
                        : ""}
                    </p>
                    <Link href={`/gpus/${entry.gpu.slug}`}>
                      View {entry.gpu.displayName} catalog page
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      ) : (
        <div className="no-results">
          <h3>No GPUs match that search</h3>
          <p>Try a different GPU name or vendor.</p>
        </div>
      )}
    </section>
  );
}

function copyWithDocumentCommand(value: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand?.("copy") === true;
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
