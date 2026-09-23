"use client";

import { useState } from "react";
import type { HardwareFormValues } from "@/application/hardware";
import {
  detectBrowserHardware,
  type BrowserDetectionResult,
  type DetectedField,
} from "@/application/browser-detection";
import type { GpuDefinition } from "@/domain/types";

type ApplyPatch = Partial<HardwareFormValues>;
type DetectionKey = "operatingSystem" | "deviceMemoryGiB" | "gpuSuggestion";

interface DeviceScanProps {
  gpus: readonly GpuDefinition[];
  onApply: (patch: ApplyPatch) => void;
  detect?: () => Promise<BrowserDetectionResult>;
}

export function DeviceScan({ gpus, onApply, detect }: DeviceScanProps) {
  const [status, setStatus] = useState<"idle" | "scanning" | "complete">(
    "idle",
  );
  const [result, setResult] = useState<BrowserDetectionResult>();
  const [scanError, setScanError] = useState(false);
  const [selected, setSelected] = useState<Set<DetectionKey>>(new Set());

  async function handleScan() {
    setStatus("scanning");
    setSelected(new Set());
    setScanError(false);
    try {
      setResult(
        await (detect ?? (() => detectBrowserHardware(undefined, gpus)))(),
      );
    } catch {
      setResult(undefined);
      setScanError(true);
    } finally {
      setStatus("complete");
    }
  }

  function toggle(key: DetectionKey) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function applySelected() {
    if (!result) return;
    const patch: ApplyPatch = {};
    if (selected.has("operatingSystem") && result.operatingSystem.value) {
      patch.operatingSystem = result.operatingSystem.value;
    }
    if (selected.has("deviceMemoryGiB") && result.deviceMemoryGiB.value) {
      patch.systemRamGiB = result.deviceMemoryGiB.value.toString();
    }
    if (selected.has("gpuSuggestion") && result.gpuSuggestion.value) {
      const gpu = gpus.find(
        (candidate) => candidate.id === result.gpuSuggestion.value?.gpuId,
      );
      if (gpu) {
        patch.gpuId = gpu.id;
        patch.vramGiB = gpu.vramGiB.toString();
      }
    }
    onApply(patch);
    setSelected(new Set());
  }

  return (
    <section className="device-scan" aria-labelledby="device-scan-heading">
      <div className="device-scan-heading">
        <div>
          <h3 id="device-scan-heading">Optional: scan your device</h3>
          <p>
            This stays in your browser and reads only coarse hints. It never
            submits or stores hardware information.
          </p>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={handleScan}
          disabled={status === "scanning"}
        >
          {status === "scanning" ? "Scanning…" : "Scan my device"}
        </button>
      </div>
      {status === "complete" && result && (
        <DetectionResults
          result={result}
          selected={selected}
          onToggle={toggle}
          onApply={applySelected}
        />
      )}
      {status === "complete" && scanError && (
        <p className="device-scan-note" role="status">
          Scanning was unavailable in this browser. Enter your hardware manually
          instead.
        </p>
      )}
    </section>
  );
}

function DetectionResults({
  result,
  selected,
  onToggle,
  onApply,
}: {
  result: BrowserDetectionResult;
  selected: Set<DetectionKey>;
  onToggle: (key: DetectionKey) => void;
  onApply: () => void;
}) {
  const hasApplyableValue = Boolean(
    result.operatingSystem.value ||
    result.deviceMemoryGiB.value ||
    result.gpuSuggestion.value,
  );
  return (
    <div className="device-scan-results" aria-live="polite">
      <p className="help-text">
        Review each hint, select the values you want to copy into the form, and
        edit them before evaluating. The scan never submits the form.
      </p>
      <DetectionRow
        label="Operating system"
        field={result.operatingSystem}
        applyKey="operatingSystem"
        selected={selected}
        onToggle={onToggle}
      />
      <DetectionRow
        label="Logical processors"
        field={result.logicalProcessors}
      />
      <DetectionRow
        label="Coarse memory hint"
        field={result.deviceMemoryGiB}
        suffix="GiB"
        applyKey="deviceMemoryGiB"
        selected={selected}
        onToggle={onToggle}
      />
      <DetectionRow label="GPU renderer hint" field={result.gpuRenderer} />
      <DetectionRow
        label="Exact dedicated VRAM"
        field={result.exactVramGiB}
        suffix="GiB"
      />
      <DetectionRow
        label="Catalog GPU suggestion"
        field={result.gpuSuggestion}
        applyKey="gpuSuggestion"
        selected={selected}
        onToggle={onToggle}
      />
      <p className="device-scan-note">
        Exact VRAM is intentionally left unknown. Confirm the GPU and enter
        dedicated VRAM manually when the browser cannot expose it.
      </p>
      {hasApplyableValue && (
        <button
          className="secondary-button"
          type="button"
          onClick={onApply}
          disabled={selected.size === 0}
        >
          Apply selected hints
        </button>
      )}
    </div>
  );
}

function DetectionRow<T>({
  label,
  field,
  suffix,
  applyKey,
  selected,
  onToggle,
}: {
  label: string;
  field: DetectedField<T>;
  suffix?: string;
  applyKey?: DetectionKey;
  selected?: Set<DetectionKey>;
  onToggle?: (key: DetectionKey) => void;
}) {
  const value = formatValue(field.value, suffix);
  return (
    <div className="device-scan-row">
      <div>
        <strong>{label}</strong>
        <span>
          {value} · {field.confidence} confidence · {field.note}
        </span>
      </div>
      {applyKey && field.value !== null && onToggle && selected && (
        <label className="scan-apply-label">
          <input
            type="checkbox"
            checked={selected.has(applyKey)}
            onChange={() => onToggle(applyKey)}
          />
          Review {label.toLowerCase()} in form
        </label>
      )}
    </div>
  );
}

function formatValue(value: unknown, suffix?: string): string {
  if (value === null) return "Unavailable";
  if (typeof value === "object" && value !== null && "displayName" in value)
    return String(value.displayName);
  if (typeof value === "string") return value;
  return `${String(value)}${suffix ? ` ${suffix}` : ""}`;
}
