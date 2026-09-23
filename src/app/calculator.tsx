"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import type {
  CalculatorEvaluation,
  CalculatorFormValues,
} from "@/application/calculator";
import { evaluateCalculator } from "@/application/calculator";
import type {
  CompatibilityLevel,
  GpuDefinition,
  ModelDefinition,
} from "@/domain/types";
import type { HardwareFormValues } from "@/application/hardware";
import { Field, HardwareFields } from "./hardware-fields";

interface CalculatorProps {
  models: readonly ModelDefinition[];
  gpus: readonly GpuDefinition[];
}

const levelLabels: Record<CompatibilityLevel, string> = {
  "gpu-capable": "GPU-capable",
  "partial-offload": "Partial offload",
  "cpu-only": "CPU-only",
  unsupported: "Unsupported",
};

const executionLabels: Record<string, string> = {
  gpu: "Full GPU execution",
  "partial-offload": "Partial GPU offload",
  cpu: "CPU execution",
  unsupported: "Not recommended for this hardware",
};

export function Calculator({ models, gpus }: CalculatorProps) {
  const firstModel = models[0];
  const [values, setValues] = useState<CalculatorFormValues>({
    modelId: firstModel?.id ?? "",
    quantizationId: firstModel?.quantizations[0]?.id ?? "",
    cpuName: "My CPU",
    gpuId: "none",
    vramGiB: "0",
    systemRamGiB: "16",
    operatingSystem: "windows",
  });
  const [evaluation, setEvaluation] = useState<CalculatorEvaluation>({
    fieldErrors: {},
  });

  const selectedModel =
    models.find((model) => model.id === values.modelId) ?? firstModel;
  function updateValue(field: keyof CalculatorFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setEvaluation({ fieldErrors: {} });
  }

  function updateHardwareValue(field: keyof HardwareFormValues, value: string) {
    updateValue(field, value);
  }

  function handleModelChange(modelId: string) {
    const model = models.find((candidate) => candidate.id === modelId);
    setValues((current) => ({
      ...current,
      modelId,
      quantizationId: model?.quantizations[0]?.id ?? "",
    }));
    setEvaluation({ fieldErrors: {} });
  }

  function handleGpuChange(gpuId: string) {
    const gpu = gpus.find((candidate) => candidate.id === gpuId);
    setValues((current) => ({
      ...current,
      gpuId,
      vramGiB: gpu?.vramGiB.toString() ?? "0",
    }));
    setEvaluation({ fieldErrors: {} });
  }

  function applyDetected(patch: Partial<HardwareFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
    setEvaluation({ fieldErrors: {} });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEvaluation(evaluateCalculator(values));
  }

  return (
    <div className="calculator-layout">
      <form className="calculator-card" onSubmit={handleSubmit} noValidate>
        <section className="form-section" aria-labelledby="model-heading">
          <div className="section-heading">
            <p className="section-number">01</p>
            <div>
              <h2 id="model-heading">Choose a model</h2>
              <p>Select one model and its quantization.</p>
            </div>
          </div>
          <Field
            id="model"
            label="Model"
            error={evaluation.fieldErrors.modelId}
          >
            <select
              id="model"
              value={values.modelId}
              onChange={(event) => handleModelChange(event.target.value)}
              required
              aria-invalid={Boolean(evaluation.fieldErrors.modelId)}
              aria-describedby={
                evaluation.fieldErrors.modelId ? "model-error" : undefined
              }
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.displayName}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="quantization"
            label="Quantization"
            help="Quantization changes the model’s memory requirement. Higher-bit options generally preserve more quality."
            error={evaluation.fieldErrors.quantizationId}
          >
            <select
              id="quantization"
              value={values.quantizationId}
              onChange={(event) =>
                updateValue("quantizationId", event.target.value)
              }
              required
              aria-invalid={Boolean(evaluation.fieldErrors.quantizationId)}
              aria-describedby={
                evaluation.fieldErrors.quantizationId
                  ? "quantization-error"
                  : undefined
              }
            >
              {selectedModel?.quantizations.map((quantization) => (
                <option key={quantization.id} value={quantization.id}>
                  {quantization.displayName} · {quantization.bitsPerWeight}{" "}
                  bits/weight
                </option>
              ))}
            </select>
          </Field>
          {selectedModel?.summary && (
            <p className="model-summary">{selectedModel.summary}</p>
          )}
        </section>

        <section className="form-section" aria-labelledby="hardware-heading">
          <div className="section-heading">
            <p className="section-number">02</p>
            <div>
              <h2 id="hardware-heading">Describe your hardware</h2>
              <p>Use the values available in your system information.</p>
            </div>
          </div>
          <HardwareFields
            values={values}
            gpus={gpus}
            fieldErrors={evaluation.fieldErrors}
            onChange={updateHardwareValue}
            onGpuChange={handleGpuChange}
            onApplyDetected={applyDetected}
          />
        </section>

        <button className="evaluate-button" type="submit">
          Evaluate compatibility <span aria-hidden="true">→</span>
        </button>
        {evaluation.formError && (
          <p className="form-error" role="alert">
            {evaluation.formError}
          </p>
        )}
      </form>

      <ResultPanel evaluation={evaluation} model={selectedModel} />
    </div>
  );
}

function ResultPanel({
  evaluation,
  model,
}: {
  evaluation: CalculatorEvaluation;
  model?: ModelDefinition;
}) {
  const result = evaluation.result;
  if (!result)
    return (
      <aside className="result-card empty-result" aria-live="polite">
        <p className="result-kicker">Your result</p>
        <h2>Ready when you are.</h2>
        <p>
          Enter your hardware details and evaluate the selected model to see a
          clear compatibility assessment.
        </p>
      </aside>
    );

  const recommended = model?.quantizations.find(
    (quantization) => quantization.id === result.recommendedQuantizationId,
  );
  return (
    <aside
      className={`result-card result-${result.level}`}
      aria-live="polite"
      aria-atomic="true"
      aria-labelledby="result-heading"
    >
      <p className="result-kicker">Compatibility result</p>
      <div className="result-title-row">
        <h2 id="result-heading">{levelLabels[result.level]}</h2>
        <span className="level-badge">{levelLabels[result.level]}</span>
      </div>
      {model && (
        <p className="result-selection">
          For <strong>{model.displayName}</strong>. Estimates are approximate
          planning guidance.
        </p>
      )}
      <p className="result-message">{result.messages[0]}</p>
      <dl className="result-stats">
        <div>
          <dt>Execution</dt>
          <dd>{executionLabels[result.executionMode]}</dd>
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
      {recommended && (
        <div className="recommendation">
          <strong>Recommended quantization</strong>
          <span>{recommended.displayName}</span>
          <small>
            This is the highest-bit candidate that fits this hardware according
            to the current estimates.
          </small>
        </div>
      )}
      <p className="context-guidance">
        <strong>Context guidance:</strong> {result.contextLengthGuidance}
      </p>
      <ResultList
        title="Limiting factors"
        items={result.limitingFactors}
        empty="No limiting factor was identified by the current estimate."
      />
      <p className="result-help">
        <Link href="/guides/compatibility-estimates">
          Learn how to interpret this estimate
        </Link>
      </p>
      <ResultList
        title="Assumptions and warnings"
        items={[
          ...result.warnings,
          `Weight overhead: ${result.assumptions.weightOverheadMultiplier}×; runtime overhead: ${result.assumptions.runtimeOverheadGiB} GiB; RAM reserve: ${result.assumptions.systemRamReserveGiB} GiB.`,
        ]}
      />
    </aside>
  );
}

function ResultList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty?: string;
}) {
  return (
    <section className="result-list">
      <h3>{title}</h3>
      {items.length ? (
        <ul>
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{empty}</p>
      )}
    </section>
  );
}
