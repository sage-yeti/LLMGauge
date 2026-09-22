"use client";

import type { HardwareFormValues } from "@/application/hardware";
import type { GpuDefinition } from "@/domain/types";

interface HardwareFieldsProps {
  values: HardwareFormValues;
  gpus: readonly GpuDefinition[];
  fieldErrors: Record<string, string>;
  onChange: (field: keyof HardwareFormValues, value: string) => void;
  onGpuChange: (gpuId: string) => void;
}

export function HardwareFields({
  values,
  gpus,
  fieldErrors,
  onChange,
  onGpuChange,
}: HardwareFieldsProps) {
  const selectedGpu = gpus.find((gpu) => gpu.id === values.gpuId);
  return (
    <>
      <Field label="CPU" error={fieldErrors.cpuName}>
        <input
          aria-label="CPU"
          value={values.cpuName}
          onChange={(event) => onChange("cpuName", event.target.value)}
          placeholder="e.g. Intel Core i5"
        />
      </Field>
      <div className="field-grid">
        <Field
          label="GPU"
          help={
            selectedGpu?.suitabilitySummary ??
            "Choose no GPU for a CPU-only evaluation."
          }
          error={fieldErrors.gpuId}
        >
          <select
            aria-label="GPU"
            value={values.gpuId}
            onChange={(event) => onGpuChange(event.target.value)}
          >
            <option value="none">No dedicated GPU</option>
            {gpus.map((gpu) => (
              <option key={gpu.id} value={gpu.id}>
                {gpu.displayName}
                {gpu.kind === "integrated" ? " · integrated" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Dedicated VRAM (GiB)"
          help={
            selectedGpu?.kind === "integrated"
              ? "Integrated GPU shared memory is not counted as dedicated VRAM."
              : "Enter dedicated GPU memory in GiB."
          }
          error={fieldErrors.vramGiB}
        >
          <input
            aria-label="Dedicated VRAM (GiB)"
            type="number"
            min="0"
            step="0.1"
            value={values.vramGiB}
            disabled={
              values.gpuId === "none" || selectedGpu?.kind === "integrated"
            }
            onChange={(event) => onChange("vramGiB", event.target.value)}
          />
        </Field>
      </div>
      <div className="field-grid">
        <Field label="System RAM (GiB)" error={fieldErrors.systemRamGiB}>
          <input
            aria-label="System RAM (GiB)"
            type="number"
            min="0.1"
            step="0.1"
            value={values.systemRamGiB}
            onChange={(event) => onChange("systemRamGiB", event.target.value)}
          />
        </Field>
        <Field label="Operating system" error={fieldErrors.operatingSystem}>
          <select
            aria-label="Operating system"
            value={values.operatingSystem}
            onChange={(event) =>
              onChange("operatingSystem", event.target.value)
            }
          >
            <option value="windows">Windows</option>
            <option value="linux">Linux</option>
            <option value="macos">macOS</option>
            <option value="other">Other</option>
          </select>
        </Field>
      </div>
    </>
  );
}

export function Field({
  label,
  help,
  error,
  children,
}: {
  label: string;
  help?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label>
        {label}
        {children}
      </label>
      {help && <span className="help-text">{help}</span>}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
