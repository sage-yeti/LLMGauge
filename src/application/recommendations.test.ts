import { describe, expect, it } from "vitest";
import { recommendModels } from "./recommendations";
import {
  fixtureHardware,
  fixtureModel,
  fixtureProvenance,
} from "@/data/fixtures";
import { productionModels } from "@/data/production-catalog";
import type { HardwareProfile, ModelDefinition } from "@/domain/types";

describe("recommendModels", () => {
  it("evaluates the curated production catalog deterministically", () => {
    const first = recommendModels(fixtureHardware.gpu, productionModels);
    const second = recommendModels(fixtureHardware.gpu, productionModels);
    expect(first.recommendations.length).toBeGreaterThan(0);
    expect(
      first.recommendations.map(
        (entry) => `${entry.model.id}/${entry.quantization.id}`,
      ),
    ).toEqual(
      second.recommendations.map(
        (entry) => `${entry.model.id}/${entry.quantization.id}`,
      ),
    );
  });

  it("evaluates valid quantizations and prefers the highest quality usable candidate", () => {
    const result = recommendModels(fixtureHardware.gpu, [fixtureModel]);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].quantization.id).toBe("q8");
    expect(result.recommendations[0].result.level).toBe("gpu-capable");
  });

  it("ranks usable outcomes above unsupported outcomes", () => {
    const result = recommendModels(fixtureHardware.cpuOnly, [fixtureModel]);
    expect(result.recommendations[0].result.level).toBe("cpu-only");
    expect(result.unsuitable).toHaveLength(0);
  });

  it("keeps an unsupported model in the separate unsuitable group", () => {
    const result = recommendModels(
      { ...fixtureHardware.cpuOnly, systemRamGiB: 1 },
      [fixtureModel],
    );
    expect(result.recommendations).toHaveLength(0);
    expect(result.unsuitable[0].result.level).toBe("unsupported");
  });

  it("prefers lower memory pressure when quality and compatibility are tied", () => {
    const smaller: ModelDefinition = {
      ...fixtureModel,
      id: "smaller-model",
      displayName: "Smaller",
      parameterCountBillions: 3,
      quantizations: [
        {
          id: "q4",
          displayName: "Q4",
          bitsPerWeight: 4,
          provenance: fixtureProvenance,
        },
      ],
    };
    const larger: ModelDefinition = {
      ...fixtureModel,
      id: "larger-model",
      displayName: "Larger",
      parameterCountBillions: 6,
      quantizations: [
        {
          id: "q4",
          displayName: "Q4",
          bitsPerWeight: 4,
          provenance: fixtureProvenance,
        },
      ],
    };
    const result = recommendModels(fixtureHardware.gpu, [larger, smaller]);
    expect(result.recommendations.map((entry) => entry.model.id)).toEqual([
      "smaller-model",
      "larger-model",
    ]);
  });

  it("uses stable IDs as the final deterministic tie-breaker", () => {
    const first: ModelDefinition = {
      ...fixtureModel,
      id: "model-a",
      displayName: "A",
    };
    const second: ModelDefinition = {
      ...fixtureModel,
      id: "model-b",
      displayName: "B",
    };
    const result = recommendModels(fixtureHardware.gpu, [second, first]);
    expect(result.recommendations.map((entry) => entry.model.id)).toEqual([
      "model-a",
      "model-b",
    ]);
  });

  it("handles no-GPU and integrated-GPU profiles through the engine", () => {
    const integrated: HardwareProfile = {
      ...fixtureHardware.cpuOnly,
      gpu: {
        id: "integrated",
        name: "Integrated",
        kind: "integrated",
        vramGiB: 0,
        sharedMemoryGiB: 8,
      },
    };
    expect(
      recommendModels(fixtureHardware.cpuOnly, [fixtureModel])
        .recommendations[0].result.level,
    ).toBe("cpu-only");
    expect(
      recommendModels(integrated, [fixtureModel]).recommendations[0].result
        .level,
    ).toBe("cpu-only");
  });

  it("skips empty, malformed, duplicate, and invalid-quantization entries safely", () => {
    const malformed = {
      ...fixtureModel,
      id: "malformed",
      parameterCountBillions: 0,
    } as ModelDefinition;
    const invalidQuantization = {
      ...fixtureModel,
      id: "invalid-quantization",
      quantizations: [{ id: "bad", displayName: "Bad", bitsPerWeight: -1 }],
    } as unknown as ModelDefinition;
    const result = recommendModels(fixtureHardware.gpu, [
      fixtureModel,
      fixtureModel,
      malformed,
      invalidQuantization,
    ]);
    expect(result.recommendations).toHaveLength(1);
    expect(result.skippedModelIds).toEqual([
      fixtureModel.id,
      malformed.id,
      invalidQuantization.id,
    ]);
  });

  it("returns empty results for an empty catalog", () => {
    expect(recommendModels(fixtureHardware.gpu, [])).toEqual({
      recommendations: [],
      unsuitable: [],
      skippedModelIds: [],
    });
  });
});
