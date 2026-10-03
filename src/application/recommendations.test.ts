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
  it.each([undefined, 4])(
    "orders same-metadata memory ties by unrounded estimates (bpw %s)",
    (bitsPerWeight) => {
      const model = (id: string, sizeGiB: number): ModelDefinition => ({
        ...fixtureModel,
        id,
        quantizations: [
          {
            id: "sized",
            displayName: "Sized",
            sizeGiB,
            bitsPerWeight,
            provenance: fixtureProvenance,
          },
        ],
      });
      // Both requirements display as 2.99 GiB; lower actual memory precedes the ID tie-breaker.
      const smaller = model("z-smaller", 2.0001);
      const larger = model("a-larger", 2.0002);
      for (const models of [
        [larger, smaller],
        [smaller, larger],
      ]) {
        expect(
          recommendModels(fixtureHardware.gpu, models).recommendations.map(
            (entry) => entry.model.id,
          ),
        ).toEqual(["z-smaller", "a-larger"]);
      }
    },
  );

  it("ranks mixed metadata deterministically by level, known bpw, memory, and stable IDs", () => {
    const sized = (id: string, sizeGiB: number): ModelDefinition => ({
      ...fixtureModel,
      id,
      quantizations: [
        {
          id: "mxfp4",
          displayName: "MXFP4",
          sizeGiB,
          provenance: fixtureProvenance,
        },
      ],
    });
    const known: ModelDefinition = {
      ...fixtureModel,
      id: "known",
      quantizations: [fixtureModel.quantizations[0]],
    };
    const entries = [
      sized("unknown-b", 2),
      sized("unknown-large", 3),
      known,
      sized("unknown-a", 2),
    ];
    for (const input of [entries, [...entries].reverse()]) {
      expect(
        recommendModels(fixtureHardware.gpu, input).recommendations.map(
          (entry) => entry.model.id,
        ),
      ).toEqual(["known", "unknown-a", "unknown-b", "unknown-large"]);
    }
    const lowVram = {
      ...fixtureHardware.gpu,
      gpu: { ...fixtureHardware.gpu.gpu!, vramGiB: 3 },
    };
    expect(
      recommendModels(lowVram, [
        known,
        sized("unknown-fit", 1),
      ]).recommendations.map((entry) => [entry.model.id, entry.result.level]),
    ).toEqual([
      ["unknown-fit", "gpu-capable"],
      ["known", "partial-offload"],
    ]);
  });

  it("uses the same missing-bpw policy for representative quantization selection", () => {
    const model: ModelDefinition = {
      ...fixtureModel,
      quantizations: [
        {
          id: "unknown-b",
          displayName: "Unknown B",
          sizeGiB: 2,
          provenance: fixtureProvenance,
        },
        fixtureModel.quantizations[0],
        {
          id: "unknown-a",
          displayName: "Unknown A",
          sizeGiB: 2,
          provenance: fixtureProvenance,
        },
      ],
    };
    expect(
      recommendModels(fixtureHardware.gpu, [model]).recommendations[0]
        .quantization.id,
    ).toBe("q4");
    expect(
      recommendModels(fixtureHardware.gpu, [
        {
          ...model,
          quantizations: model.quantizations.filter(
            (candidate) => candidate.bitsPerWeight === undefined,
          ),
        },
      ]).recommendations[0].quantization.id,
    ).toBe("unknown-a");
  });

  it("keeps existing known-bpw fixture ordering with an added size-only model", () => {
    const a = { ...fixtureModel, id: "known-a" };
    const b = { ...fixtureModel, id: "known-b" };
    const unknown: ModelDefinition = {
      ...fixtureModel,
      id: "unknown",
      quantizations: [
        {
          id: "mxfp4",
          displayName: "MXFP4",
          sizeGiB: 1,
          provenance: fixtureProvenance,
        },
      ],
    };
    expect(
      recommendModels(fixtureHardware.gpu, [b, unknown, a]).recommendations.map(
        (entry) => [entry.model.id, entry.quantization.id],
      ),
    ).toEqual([
      ["known-a", "q8"],
      ["known-b", "q8"],
      ["unknown", "mxfp4"],
    ]);
  });

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

  it("includes the new Qwen models in hardware-specific recommendations", () => {
    const hardware: HardwareProfile = {
      cpu: { name: "Example CPU" },
      gpu: {
        id: "example-24gb-gpu",
        name: "Example 24 GiB GPU",
        kind: "discrete",
        vramGiB: 24,
      },
      systemRamGiB: 64,
      operatingSystem: "linux",
    };
    const result = recommendModels(hardware, productionModels);
    const recommendedIds = result.recommendations.map(
      (entry) => entry.model.id,
    );
    expect(recommendedIds).toEqual(
      expect.arrayContaining([
        "qwen-qwen3-5-0-8b",
        "qwen-qwen3-5-4b",
        "qwen-qwen3-5-9b",
        "qwen-qwen3-8-27b",
      ]),
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

  it("orders discrete-PC GPU-capable models by catalogued parameter count", () => {
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
    for (const models of [
      [larger, smaller],
      [smaller, larger],
    ]) {
      const result = recommendModels(fixtureHardware.gpu, models);
      expect(result.recommendations.map((entry) => entry.model.id)).toEqual([
        "larger-model",
        "smaller-model",
      ]);
      expect(
        result.recommendations.map((entry) => entry.quantization.id),
      ).toEqual(["q4", "q4"]);
    }
  });

  it("keeps full-GPU fits above partial offload and preserves partial ordering", () => {
    const gpuFit: ModelDefinition = {
      ...fixtureModel,
      id: "small-gpu-fit",
      parameterCountBillions: 3,
      quantizations: [
        {
          ...fixtureModel.quantizations[0],
          id: "fit",
          sizeGiB: 1,
        },
      ],
    };
    const partial = (id: string, parameterCountBillions: number) => ({
      ...fixtureModel,
      id,
      parameterCountBillions,
      quantizations: [
        {
          ...fixtureModel.quantizations[0],
          id: "partial",
          sizeGiB: 8,
        },
      ],
    });
    const partialSmall = partial("partial-small", 5);
    const partialLarge = partial("partial-large", 20);
    const hardware = {
      ...fixtureHardware.gpu,
      gpu: { ...fixtureHardware.gpu.gpu!, vramGiB: 4 },
      systemRamGiB: 32,
    };

    const result = recommendModels(hardware, [
      partialLarge,
      gpuFit,
      partialSmall,
    ]);
    expect(
      result.recommendations.map((entry) => [
        entry.model.id,
        entry.result.level,
      ]),
    ).toEqual([
      ["small-gpu-fit", "gpu-capable"],
      ["partial-large", "partial-offload"],
      ["partial-small", "partial-offload"],
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

  it("passes an optional runtime profile through without changing ranking", () => {
    const result = recommendModels(fixtureHardware.gpu, [fixtureModel], {
      runtime: "llama.cpp",
      backend: "cuda",
      executionPreference: "full-gpu",
      targetContextLength: 4096,
    });
    expect(result.recommendations[0].result.level).toBe("gpu-capable");
    expect(result.recommendations[0].result.runtimeGuidance.profile).toEqual({
      runtime: "llama.cpp",
      backend: "cuda",
      executionPreference: "full-gpu",
      targetContextLength: 4096,
    });
  });

  it("ranks explicit CPU recommendations using cache-inclusive RAM requirements", () => {
    const llama = productionModels.find(
      (model) => model.id === "meta-llama-3-1-8b-instruct",
    )!;
    const candidate = {
      id: "sourced-size",
      displayName: "Sourced size",
      sizeGiB: 2,
      provenance: fixtureProvenance,
    };
    const supported = {
      ...llama,
      quantizations: [candidate],
    };
    const noCache: ModelDefinition = {
      ...supported,
      id: "zz-no-cache-metadata",
      slug: "zz-no-cache-metadata",
      displayName: "No cache metadata",
      kvCacheMetadata: undefined,
    };
    const hardware = { ...fixtureHardware.cpuOnly, systemRamGiB: 128 };
    const noTarget = recommendModels(hardware, [supported, noCache]);
    const withTarget = recommendModels(hardware, [supported, noCache], {
      executionPreference: "cpu",
      targetContextLength: 4096,
    });
    expect(noTarget.recommendations.map((entry) => entry.model.id)).toEqual([
      "meta-llama-3-1-8b-instruct",
      "zz-no-cache-metadata",
    ]);
    expect(withTarget.recommendations.map((entry) => entry.model.id)).toEqual([
      "zz-no-cache-metadata",
      "meta-llama-3-1-8b-instruct",
    ]);
    expect(withTarget.recommendations[1].result.kvCache.includedInFit).toBe(
      true,
    );
  });
});

describe("Apple recommendation policy", () => {
  const hardware: HardwareProfile = {
    memoryMode: "apple-unified",
    cpu: { name: "Apple M4" },
    operatingSystem: "macos",
    systemRamGiB: 16,
  };
  it("selects fitting quantizations ahead of unsupported and retains metadata/memory/ID ties", () => {
    const model = (
      id: string,
      sizeGiB: number,
      bitsPerWeight?: number,
    ): ModelDefinition => ({
      ...fixtureModel,
      id,
      quantizations: [
        {
          id: "sourced",
          displayName: "Sourced",
          sizeGiB,
          bitsPerWeight,
          provenance: fixtureProvenance,
        },
      ],
    });
    const models = [
      model("z-tie", 2, 4),
      model("a-tie", 2, 4),
      model("smaller", 1, 4),
      model("known", 3, 8),
      model("unknown", 1),
      model("too-large", 100, 16),
    ];
    for (const entries of [models, [...models].reverse()]) {
      const result = recommendModels(hardware, entries);
      expect(result.recommendations.map((e) => e.model.id)).toEqual([
        "known",
        "smaller",
        "a-tie",
        "z-tie",
        "unknown",
      ]);
      expect(result.unsuitable.map((e) => e.model.id)).toEqual(["too-large"]);
      expect(
        result.recommendations.every(
          (e) =>
            e.result.level === "unified-memory-fit" &&
            e.result.executionMode === "unverified",
        ),
      ).toBe(true);
    }
    const mixed = {
      ...fixtureModel,
      quantizations: [
        { ...fixtureModel.quantizations[0], id: "fits", sizeGiB: 2 },
        {
          ...fixtureModel.quantizations[0],
          id: "too-large",
          bitsPerWeight: 16,
          sizeGiB: 100,
        },
      ],
    };
    expect(
      recommendModels(hardware, [mixed]).recommendations[0].quantization.id,
    ).toBe("fits");
  });
  it("includes both GPT-OSS entries with one pool and sourced sizes", () => {
    const result = recommendModels(
      { ...hardware, systemRamGiB: 128 },
      productionModels,
    );
    for (const id of ["openai-gpt-oss-20b", "openai-gpt-oss-120b"]) {
      const entry = result.recommendations.find((e) => e.model.id === id)!;
      expect(entry.result.memory.estimatedVramGiB).toBeNull();
      expect(entry.result.memory.estimatedUnifiedMemoryGiB).toBeDefined();
      expect(entry.result.level).toBe("unified-memory-fit");
    }
  });
});
