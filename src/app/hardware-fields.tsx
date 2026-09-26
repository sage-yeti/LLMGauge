"use client";

import type { HardwareFormValues } from "@/application/hardware";
import type { GpuDefinition } from "@/domain/types";
import { DeviceScan } from "./device-scan";

interface HardwareFieldsProps {
  values: HardwareFormValues;
  gpus: readonly GpuDefinition[];
  fieldErrors: Record<string, string>;
  onChange: (field: keyof HardwareFormValues, value: string) => void;
  onGpuChange: (gpuId: string) => void;
  onApplyDetected: (patch: Partial<HardwareFormValues>) => void;
}

export function HardwareFields({
  values,
  gpus,
  fieldErrors,
  onChange,
  onGpuChange,
  onApplyDetected,
}: HardwareFieldsProps) {
  const selectedGpu = gpus.find((gpu) => gpu.id === values.gpuId);
  return (
    <>
      <p className="hardware-example-note">
        Prefilled values are starter examples, not readings detected from your
        device. Edit them for your PC. Scanning is optional and starts only when
        you choose Scan my device.
      </p>
      <DeviceScan gpus={gpus} onApply={onApplyDetected} />
      <Field
        id="cpu"
        label="CPU"
        help="For example, Intel Core i5 or AMD Ryzen 5."
        error={fieldErrors.cpuName}
      >
        <input
          id="cpu"
          value={values.cpuName}
          onChange={(event) => onChange("cpuName", event.target.value)}
          placeholder="e.g. AMD Ryzen 7 7800X3D"
          required
          aria-invalid={Boolean(fieldErrors.cpuName)}
          aria-describedby={fieldErrors.cpuName ? "cpu-error" : "cpu-help"}
        />
      </Field>
      <div className="field-grid">
        <Field
          id="gpu"
          label="GPU"
          help={
            selectedGpu?.suitabilitySummary ??
            "Choose no GPU for a CPU-only evaluation."
          }
          error={fieldErrors.gpuId}
        >
          <select
            id="gpu"
            value={values.gpuId}
            onChange={(event) => onGpuChange(event.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.gpuId)}
            aria-describedby={fieldErrors.gpuId ? "gpu-error" : "gpu-help"}
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
          id="vram"
          label="Dedicated VRAM (GiB)"
          help={
            selectedGpu?.kind === "integrated"
              ? "Integrated GPU shared memory is not counted as dedicated VRAM."
              : "Enter dedicated GPU memory in GiB."
          }
          error={fieldErrors.vramGiB}
          required={
            values.gpuId !== "none" && selectedGpu?.kind !== "integrated"
          }
        >
          <input
            id="vram"
            type="number"
            min="0"
            step="0.1"
            value={values.vramGiB}
            disabled={
              values.gpuId === "none" || selectedGpu?.kind === "integrated"
            }
            onChange={(event) => onChange("vramGiB", event.target.value)}
            aria-invalid={Boolean(fieldErrors.vramGiB)}
            aria-describedby={fieldErrors.vramGiB ? "vram-error" : "vram-help"}
          />
        </Field>
      </div>
      <div className="field-grid">
        <Field
          id="system-ram"
          label="System RAM (GiB)"
          help="Total memory available to the operating system, for example 16 GiB."
          error={fieldErrors.systemRamGiB}
        >
          <input
            id="system-ram"
            type="number"
            min="0.1"
            step="0.1"
            value={values.systemRamGiB}
            onChange={(event) => onChange("systemRamGiB", event.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.systemRamGiB)}
            aria-describedby={
              fieldErrors.systemRamGiB ? "system-ram-error" : "system-ram-help"
            }
          />
        </Field>
        <Field
          id="operating-system"
          label="Operating system"
          error={fieldErrors.operatingSystem}
        >
          <select
            id="operating-system"
            value={values.operatingSystem}
            onChange={(event) =>
              onChange("operatingSystem", event.target.value)
            }
            required
            aria-invalid={Boolean(fieldErrors.operatingSystem)}
            aria-describedby={
              fieldErrors.operatingSystem ? "operating-system-error" : undefined
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
  id,
  label,
  help,
  error,
  required = true,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label className={required ? "required-label" : undefined} htmlFor={id}>
        {label}
      </label>
      {help && (
        <span className="help-text" id={`${id}-help`}>
          {help}
        </span>
      )}
      {error && (
        <span className="field-error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
      {children}
    </div>
  );
}
