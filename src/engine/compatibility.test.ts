import { describe, expect, it } from "vitest";
import {
  evaluateCompatibility,
  estimateMemory,
  recommendQuantization,
} from "./compatibility";
import { DEFAULT_COMPATIBILITY_POLICY } from "./assumptions";
import {
  fixtureHardware,
  fixtureModel,
  fixtureProvenance,
} from "@/data/fixtures";
import type { HardwareProfile, ModelDefinition } from "@/domain/types";

describe("compatibility engine", () => {
  it("estimates weights and overhead using the default policy", () => {
    expect(
      estimateMemory(fixtureModel, fixtureModel.quantizations[0]),
    ).toMatchObject({
      modelWeightsGiB: 3.5,
      runtimeOverheadGiB: 0.75,
      estimatedVramGiB: 4.67,
      estimatedSystemRamGiB: 6.67,
    });
  });

  it("uses caller-supplied assumptions deterministically", () => {
    const policy = {
      ...DEFAULT_COMPATIBILITY_POLICY,
      weightOverheadMultiplier: 1,
      runtimeOverheadGiB: 1,
      systemRamReserveGiB: 3,
      availableMemorySafetyMarginGiB: 1,
      defaultContextLength: 2048,
    };
    expect(
      estimateMemory(fixtureModel, fixtureModel.quantizations[0], policy),
    ).toEqual({
      modelWeightsGiB: 3.5,
      runtimeOverheadGiB: 1,
      estimatedVramGiB: 4.5,
      estimatedSystemRamGiB: 7.5,
    });
  });

  it("classifies a GPU-capable profile", () => {
    expect(
      evaluateCompatibility(
        fixtureHardware.gpu,
        fixtureModel,
        fixtureModel.quantizations[0],
      ).level,
    ).toBe("gpu-capable");
  });

  it("accepts exact VRAM and RAM boundary fits", () => {
    const estimate = estimateMemory(
      fixtureModel,
      fixtureModel.quantizations[0],
    );
    const hardware: HardwareProfile = {
      cpu: { name: "Boundary CPU" },
      gpu: {
        id: "boundary-gpu",
        name: "Boundary GPU",
        kind: "discrete",
        vramGiB: estimate.estimatedVramGiB,
      },
      systemRamGiB: estimate.estimatedSystemRamGiB,
      operatingSystem: "linux",
    };
    expect(
      evaluateCompatibility(
        hardware,
        fixtureModel,
        fixtureModel.quantizations[0],
      ).level,
    ).toBe("gpu-capable");
  });

  it("classifies a CPU-only profile", () => {
    expect(
      evaluateCompatibility(
        fixtureHardware.cpuOnly,
        fixtureModel,
        fixtureModel.quantizations[0],
      ).level,
    ).toBe("cpu-only");
  });

  it("classifies partial offload when RAM is sufficient but VRAM is not", () => {
    const result = evaluateCompatibility(
      fixtureHardware.lowMemory,
      fixtureModel,
      fixtureModel.quantizations[1],
    );
    expect(result.level).toBe("partial-offload");
    expect(result.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(["insufficient-vram", "partial-offload"]),
    );
  });

  it("rejects a GPU fit when system RAM is insufficient", () => {
    const result = evaluateCompatibility(
      { ...fixtureHardware.gpu, systemRamGiB: 1 },
      fixtureModel,
      fixtureModel.quantizations[0],
    );
    expect(result.level).toBe("unsupported");
    expect(result.limitingFactors).toContain(
      "Available system RAM is below the estimated requirement.",
    );
  });

  it("treats integrated GPU memory as shared rather than dedicated VRAM", () => {
    const result = evaluateCompatibility(
      {
        ...fixtureHardware.cpuOnly,
        gpu: {
          id: "integrated",
          name: "Integrated",
          kind: "integrated",
          vramGiB: 0,
          sharedMemoryGiB: 8,
        },
      },
      fixtureModel,
      fixtureModel.quantizations[0],
    );
    expect(result.level).toBe("cpu-only");
    expect(result.warnings).toContain(
      "Integrated GPU shared memory is not counted as dedicated VRAM.",
    );
    expect(result.reasons.map((reason) => reason.code)).toContain(
      "integrated-shared-memory",
    );
  });

  it("recommends the highest precision fitting candidate", () => {
    expect(
      recommendQuantization(fixtureHardware.gpu, fixtureModel)?.quantizationId,
    ).toBe("q8");
  });

  it("uses stable input ordering when precision is tied", () => {
    const model: ModelDefinition = {
      ...fixtureModel,
      quantizations: [
        {
          id: "first",
          displayName: "First",
          bitsPerWeight: 4,
          provenance: fixtureProvenance,
        },
        {
          id: "second",
          displayName: "Second",
          bitsPerWeight: 4,
          provenance: fixtureProvenance,
        },
      ],
    };
    expect(
      recommendQuantization(fixtureHardware.cpuOnly, model)?.quantizationId,
    ).toBe("first");
  });

  it("skips malformed quantization candidates during recommendation", () => {
    const model = {
      ...fixtureModel,
      quantizations: [
        { id: "bad", displayName: "Bad", bitsPerWeight: -1 },
        fixtureModel.quantizations[0],
      ],
    } as unknown as ModelDefinition;
    expect(
      recommendQuantization(fixtureHardware.cpuOnly, model)?.quantizationId,
    ).toBe("q4");
  });

  it("rejects invalid inputs and models without candidates", () => {
    expect(() =>
      evaluateCompatibility(
        { ...fixtureHardware.gpu, systemRamGiB: 0 },
        fixtureModel,
        fixtureModel.quantizations[0],
      ),
    ).toThrow(/Invalid hardware/);
    expect(() =>
      evaluateCompatibility(
        fixtureHardware.gpu,
        { ...fixtureModel, quantizations: [] },
        fixtureModel.quantizations[0],
      ),
    ).toThrow("no quantization candidates");
    expect(
      recommendQuantization(fixtureHardware.gpu, {
        ...fixtureModel,
        quantizations: [],
      }),
    ).toBeUndefined();
  });

  it("returns explicit assumptions, warnings, and stable result fields", () => {
    expect(
      Object.keys(
        evaluateCompatibility(
          fixtureHardware.gpu,
          fixtureModel,
          fixtureModel.quantizations[0],
        ),
      ),
    ).toEqual([
      "modelId",
      "quantizationId",
      "level",
      "executionMode",
      "memory",
      "recommendedQuantizationId",
      "contextLengthGuidance",
      "limitingFactors",
      "messages",
      "reasons",
      "assumptions",
      "warnings",
    ]);
  });

  it("exposes exact-boundary and safety-margin reasons", () => {
    const estimate = estimateMemory(
      fixtureModel,
      fixtureModel.quantizations[0],
    );
    const result = evaluateCompatibility(
      {
        ...fixtureHardware.gpu,
        gpu: fixtureHardware.gpu.gpu
          ? { ...fixtureHardware.gpu.gpu, vramGiB: estimate.estimatedVramGiB }
          : undefined,
        systemRamGiB: estimate.estimatedSystemRamGiB,
      },
      fixtureModel,
      fixtureModel.quantizations[0],
      { ...DEFAULT_COMPATIBILITY_POLICY, availableMemorySafetyMarginGiB: 0.25 },
    );
    expect(result.reasons.map((reason) => reason.code)).toContain(
      "exact-memory-boundary",
    );
    expect(result.reasons.map((reason) => reason.code)).toContain(
      "safety-margin",
    );
  });
});
