import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BrowserDetectionResult } from "@/application/browser-detection";
import { gpuCatalog } from "@/data/catalog";
import {
  applyDetectedHardware,
  type HardwareFormValues,
} from "@/application/hardware";
import { DeviceScan } from "./device-scan";

const detected: BrowserDetectionResult = {
  operatingSystem: {
    value: "linux",
    source: "user-agent-data",
    confidence: "high",
    safeToApply: true,
    note: "Platform hint",
  },
  logicalProcessors: {
    value: 8,
    source: "hardware-concurrency",
    confidence: "medium",
    safeToApply: false,
    note: "Logical processor hint",
  },
  deviceMemoryGiB: {
    value: 16,
    source: "device-memory",
    confidence: "low",
    safeToApply: false,
    note: "Coarse memory hint",
  },
  gpuRenderer: {
    value: "ANGLE (NVIDIA, GeForce RTX 3060)",
    source: "webgl",
    confidence: "low",
    safeToApply: false,
    note: "Renderer hint",
  },
  gpuSuggestion: {
    value: {
      gpuId: "nvidia-rtx-3060-12gb",
      displayName: "GeForce RTX 3060 12GB",
    },
    source: "webgl",
    confidence: "low",
    safeToApply: false,
    note: "Confirm manually",
  },
  exactVramGiB: {
    value: null,
    source: "not-exposed",
    confidence: "unknown",
    safeToApply: false,
    note: "Unavailable",
  },
};

describe("device scan control", () => {
  afterEach(cleanup);

  it("shows scanning results and requires explicit selection before applying", async () => {
    const onApply = vi.fn();
    render(
      <DeviceScan
        gpus={gpuCatalog}
        onApply={onApply}
        detect={() => Promise.resolve(detected)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Scan my device" }));
    await waitFor(() =>
      expect(screen.getByText("Exact dedicated VRAM")).toBeTruthy(),
    );
    expect(
      screen.getByText("Unavailable · unknown confidence · Unavailable"),
    ).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("Review operating system in form"));
    fireEvent.click(
      screen.getByRole("button", { name: "Apply selected hints" }),
    );
    expect(onApply).toHaveBeenCalledWith({ operatingSystem: "linux" });
  });

  it("applies a macOS hint without opting into Apple unified memory", async () => {
    let values: HardwareFormValues = {
      cpuName: "CPU",
      gpuId: "none",
      vramGiB: "0",
      systemRamGiB: "16",
      operatingSystem: "windows",
    };
    render(
      <DeviceScan
        gpus={gpuCatalog}
        onApply={(patch) => {
          values = applyDetectedHardware(values, patch);
        }}
        detect={() =>
          Promise.resolve({
            ...detected,
            operatingSystem: { ...detected.operatingSystem, value: "macos" },
          })
        }
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Scan my device" }));
    await waitFor(() =>
      expect(
        screen.getByLabelText("Review operating system in form"),
      ).toBeTruthy(),
    );
    fireEvent.click(screen.getByLabelText("Review operating system in form"));
    fireEvent.click(
      screen.getByRole("button", { name: "Apply selected hints" }),
    );
    expect(values.operatingSystem).toBe("macos");
    expect(values.memoryMode).toBeUndefined();
    expect(values.gpuId).toBe("none");
  });

  it("keeps the exact VRAM field unavailable even with a GPU suggestion", async () => {
    render(
      <DeviceScan
        gpus={gpuCatalog}
        onApply={vi.fn()}
        detect={() => Promise.resolve(detected)}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Scan my device" }));
    await waitFor(() =>
      expect(screen.getByText("GPU renderer hint")).toBeTruthy(),
    );
    expect(
      screen.getByText(/Exact VRAM is intentionally left unknown/),
    ).toBeTruthy();
  });

  it("falls back to manual entry when scanning throws", async () => {
    render(
      <DeviceScan
        gpus={gpuCatalog}
        onApply={vi.fn()}
        detect={() => Promise.reject(new Error("blocked"))}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Scan my device" }));
    await waitFor(() =>
      expect(
        screen.getByText(/Scanning was unavailable in this browser/),
      ).toBeTruthy(),
    );
  });
});
