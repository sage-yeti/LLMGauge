import type { HardwareFormValues } from "./hardware";
import { describe, expect, it } from "vitest";
import {
  applyDetectedHardware,
  parseHardwareForm,
  parseRuntimeProfile,
} from "./hardware";

const emptyValues = {
  runtime: "" as const,
  backend: "" as const,
  executionPreference: "" as const,
  targetContextLength: "",
};

describe("parseRuntimeProfile", () => {
  it("omits the profile when no optional runtime field is selected", () => {
    expect(parseRuntimeProfile(emptyValues)).toEqual({ fieldErrors: {} });
  });

  it("normalizes a valid runtime planning profile", () => {
    expect(
      parseRuntimeProfile({
        ...emptyValues,
        runtime: "llama.cpp",
        backend: "cuda",
        executionPreference: "partial-offload",
        targetContextLength: "8192",
      }),
    ).toEqual({
      fieldErrors: {},
      runtimeProfile: {
        runtime: "llama.cpp",
        backend: "cuda",
        executionPreference: "partial-offload",
        targetContextLength: 8192,
      },
    });
  });

  it("reports invalid optional values without touching hardware parsing", () => {
    const result = parseRuntimeProfile({
      ...emptyValues,
      backend: "directx" as never,
      targetContextLength: "0",
    });
    expect(result.runtimeProfile).toBeUndefined();
    expect(result.fieldErrors.backend).toBeDefined();
    expect(result.fieldErrors.targetContextLength).toMatch(/whole number/);
  });
});

describe("Apple form boundary and scan safety", () => {
  const values: HardwareFormValues = {
    cpuName: "Apple M4",
    gpuId: "nvidia-rtx-4060-8gb",
    vramGiB: "8",
    systemRamGiB: "16",
    operatingSystem: "macos" as const,
  };
  it("excludes all retained hidden GPU inputs in Apple mode, including invalid text", () => {
    const result = parseHardwareForm({
      ...values,
      memoryMode: "apple-unified",
      gpuId: "stale",
      vramGiB: "invalid",
    });
    expect(result.hardware).toEqual({
      cpu: { name: "Apple M4" },
      memoryMode: "apple-unified",
      systemRamGiB: 16,
      operatingSystem: "macos",
    });
    expect(result.fieldErrors).toEqual({});
  });
  it("rejects non-macOS and empty or invalid total memory", () => {
    expect(
      parseHardwareForm({
        ...values,
        memoryMode: "apple-unified",
        operatingSystem: "windows",
      }).fieldErrors.operatingSystem,
    ).toBeDefined();
    for (const systemRamGiB of ["", "0", "-1", "Infinity", "invalid"])
      expect(
        parseHardwareForm({
          ...values,
          memoryMode: "apple-unified",
          systemRamGiB,
        }).fieldErrors.systemRamGiB,
      ).toBeDefined();
  });
  it("does not infer or scan-enable Apple mode and protects Apple macOS/GPU fields", () => {
    const scan = {
      memoryMode: "apple-unified" as const,
      operatingSystem: "macos" as const,
      gpuId: "none",
      vramGiB: "0",
      systemRamGiB: "8",
    };
    expect(applyDetectedHardware(values, scan).memoryMode).toBeUndefined();
    expect(
      parseHardwareForm(applyDetectedHardware(values, scan)).hardware
        ?.memoryMode,
    ).toBeUndefined();
    const apple = { ...values, memoryMode: "apple-unified" as const };
    expect(
      applyDetectedHardware(apple, {
        ...scan,
        operatingSystem: "linux",
        gpuId: "fake",
        vramGiB: "900",
      }),
    ).toEqual({ ...apple, systemRamGiB: "8" });
  });
});
