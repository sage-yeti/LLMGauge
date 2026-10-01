import { getModelById } from "@/data/catalog";
import { describe, expect, it } from "vitest";
import {
  buildContextGuidance,
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
import type {
  HardwareProfile,
  ModelDefinition,
  MemoryEstimate,
  QuantizationDefinition,
} from "@/domain/types";

function expectMemory(actual: MemoryEstimate, expected: MemoryEstimate) {
  for (const key of Object.keys(expected) as (keyof MemoryEstimate)[]) {
    expect(actual[key], key).toBeCloseTo(expected[key], 12);
  }
}

describe("compatibility engine", () => {
  const eightBModel = { ...fixtureModel, parameterCountBillions: 8 };

  it("converts 4 billion fallback weight bytes to GiB before applying overhead", () => {
    // Independent byte reference: 8 billion 4-bit weights = 4,000,000,000 bytes.
    expectMemory(estimateMemory(eightBModel, eightBModel.quantizations[0]), {
      modelWeightsGiB: 3.725290298461914,
      runtimeOverheadGiB: 0.75,
      estimatedVramGiB: 4.922325134277344,
      estimatedSystemRamGiB: 6.922325134277344,
    });
  });

  it.each([0, 0.25])(
    "uses inclusive unrounded GPU and RAM thresholds with %s GiB safety margin",
    (margin) => {
      const policy = {
        ...DEFAULT_COMPATIBILITY_POLICY,
        availableMemorySafetyMarginGiB: margin,
      };
      // Independently calculated default requirements, plus the policy margin.
      const vram = 4.922325134277344 + margin;
      const ram = 6.922325134277344 + margin;
      const hardware = (
        vramGiB: number,
        systemRamGiB: number,
      ): HardwareProfile => ({
        ...fixtureHardware.gpu,
        gpu: { ...fixtureHardware.gpu.gpu!, vramGiB },
        systemRamGiB,
      });
      const evaluate = (profile: HardwareProfile) =>
        evaluateCompatibility(
          profile,
          eightBModel,
          eightBModel.quantizations[0],
          policy,
        );

      for (const delta of [-0.000001, 0, 0.000001]) {
        const result = evaluate(hardware(vram + delta, ram + delta));
        expect(result.level).toBe(delta < 0 ? "unsupported" : "gpu-capable");
        expect(
          result.reasons.some(
            (reason) => reason.code === "exact-memory-boundary",
          ),
        ).toBe(delta === 0);
        expect(evaluate(hardware(vram + delta, ram + 1)).level).toBe(
          delta < 0 ? "partial-offload" : "gpu-capable",
        );
        expect(
          evaluate({ ...fixtureHardware.cpuOnly, systemRamGiB: ram + delta })
            .level,
        ).toBe(delta < 0 ? "unsupported" : "cpu-only");
      }
      // Matching the base estimate is below the fit boundary when a margin exists.
      if (margin > 0) {
        const below = evaluate(hardware(vram - margin, ram - margin));
        expect(below.level).toBe("unsupported");
        expect(below.reasons.map((reason) => reason.code)).not.toContain(
          "exact-memory-boundary",
        );
      }
    },
  );

  it("preserves precise sourced sizes and distinguishes fits with identical display values", () => {
    const candidate: QuantizationDefinition = {
      ...fixtureModel.quantizations[0],
      bitsPerWeight: undefined,
      sizeGiB: 5.0001,
    };
    const model = { ...fixtureModel, quantizations: [candidate] };
    const memory = estimateMemory(model, candidate);
    expect(memory.modelWeightsGiB).toBe(5.0001);
    expect(memory.estimatedVramGiB).toBeCloseTo(6.350112, 12);
    expect(memory.estimatedSystemRamGiB).toBeCloseTo(8.350112, 12);
    const evaluate = (vramGiB: number, systemRamGiB: number) =>
      evaluateCompatibility(
        {
          ...fixtureHardware.gpu,
          gpu: { ...fixtureHardware.gpu.gpu!, vramGiB },
          systemRamGiB,
        },
        model,
        candidate,
      );
    expect(evaluate(6.35, 9).level).toBe("partial-offload");
    expect(evaluate(6.351, 9).level).toBe("gpu-capable");
    expect(evaluate(7, 8.35).level).toBe("unsupported");
    expect(evaluate(7, 8.351).level).toBe("gpu-capable");
    expect(
      evaluate(6.35, 9).reasons.map((reason) => reason.code),
    ).not.toContain("exact-memory-boundary");
  });

  it("keeps size-only fits inclusive at full precision with configured overhead and margin", () => {
    const candidate: QuantizationDefinition = {
      ...fixtureModel.quantizations[0],
      bitsPerWeight: undefined,
      sizeGiB: 5.0009765625,
    };
    const model = { ...fixtureModel, quantizations: [candidate] };
    const policy = {
      ...DEFAULT_COMPATIBILITY_POLICY,
      weightOverheadMultiplier: 1.25,
      availableMemorySafetyMarginGiB: 0.25,
    };
    // Binary-exact independent reference: 5.0009765625 × 1.25 + 0.75 + 0.25.
    const vram = 7.251220703125;
    const ram = 9.251220703125;
    for (const delta of [-0.000001, 0, 0.000001]) {
      const result = evaluateCompatibility(
        {
          ...fixtureHardware.gpu,
          gpu: { ...fixtureHardware.gpu.gpu!, vramGiB: vram + delta },
          systemRamGiB: ram + delta,
        },
        model,
        candidate,
        policy,
      );
      expect(result.level).toBe(delta < 0 ? "unsupported" : "gpu-capable");
      expect(
        result.reasons.some(
          (reason) => reason.code === "exact-memory-boundary",
        ),
      ).toBe(delta === 0);
    }
  });

  it("uses sourced file size with or without bits per weight and preserves overheads", () => {
    const base = fixtureModel.quantizations[0];
    const expected = {
      modelWeightsGiB: 5,
      runtimeOverheadGiB: 0.75,
      estimatedVramGiB: 6.35,
      estimatedSystemRamGiB: 8.35,
    };
    expectMemory(
      estimateMemory(fixtureModel, {
        ...base,
        bitsPerWeight: undefined,
        sizeGiB: 5,
      }),
      expected,
    );
    expectMemory(
      estimateMemory(fixtureModel, { ...base, bitsPerWeight: 16, sizeGiB: 5 }),
      expected,
    );
    const sized = { ...base, bitsPerWeight: undefined, sizeGiB: 5 };
    expect(
      evaluateCompatibility(
        fixtureHardware.gpu,
        { ...fixtureModel, quantizations: [sized] },
        sized,
      ).level,
    ).toBe("gpu-capable");
  });

  it("rejects direct estimates with missing or invalid sizing instead of producing NaN", () => {
    for (const sizing of [
      { bitsPerWeight: undefined, sizeGiB: undefined },
      { bitsPerWeight: 0, sizeGiB: 5 },
      { bitsPerWeight: NaN, sizeGiB: 5 },
      { bitsPerWeight: 17, sizeGiB: 5 },
      { bitsPerWeight: 4, sizeGiB: Infinity },
      { bitsPerWeight: 4, sizeGiB: -1 },
    ]) {
      expect(() =>
        estimateMemory(fixtureModel, {
          ...fixtureModel.quantizations[0],
          ...sizing,
        } as QuantizationDefinition),
      ).toThrow(/Invalid quantization/);
    }
  });

  it("orders known metadata before size-only candidates and preserves input ties", () => {
    const sizeOnly: QuantizationDefinition = {
      id: "size-only",
      displayName: "Size only",
      sizeGiB: 1,
      provenance: fixtureProvenance,
    };
    const model: ModelDefinition = {
      ...fixtureModel,
      quantizations: [sizeOnly, ...fixtureModel.quantizations],
    };
    expect(
      recommendQuantization(fixtureHardware.gpu, model)?.quantizationId,
    ).toBe("q8");
    // The known candidates no longer fit; the valid size-only candidate still can.
    expect(
      recommendQuantization(
        { ...fixtureHardware.cpuOnly, systemRamGiB: 4 },
        model,
      )?.quantizationId,
    ).toBe("size-only");
    expect(
      recommendQuantization(fixtureHardware.cpuOnly, {
        ...model,
        quantizations: [sizeOnly, { ...sizeOnly, id: "other" }],
      })?.quantizationId,
    ).toBe("size-only");
    expect(
      recommendQuantization(fixtureHardware.cpuOnly, {
        ...model,
        quantizations: [
          {
            ...sizeOnly,
            sizeGiB: undefined,
          } as unknown as QuantizationDefinition,
          sizeOnly,
        ],
      })?.quantizationId,
    ).toBe("size-only");
  });

  it("estimates weights and overhead using the default policy", () => {
    // 7B × 4 bits is 3.5 billion bytes, not 3.5 GiB.
    expectMemory(estimateMemory(fixtureModel, fixtureModel.quantizations[0]), {
      modelWeightsGiB: 3.2596290111541748,
      runtimeOverheadGiB: 0.75,
      estimatedVramGiB: 4.400784492492676,
      estimatedSystemRamGiB: 6.400784492492676,
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
    expectMemory(
      estimateMemory(fixtureModel, fixtureModel.quantizations[0], policy),
      {
        modelWeightsGiB: 3.2596290111541748,
        runtimeOverheadGiB: 1,
        estimatedVramGiB: 4.259629011154175,
        estimatedSystemRamGiB: 7.259629011154175,
      },
    );
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
      "contextGuidance",
      "runtimeGuidance",
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
          ? {
              ...fixtureHardware.gpu.gpu,
              vramGiB: estimate.estimatedVramGiB + 0.25,
            }
          : undefined,
        systemRamGiB: estimate.estimatedSystemRamGiB + 0.25,
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

  it("returns structured conservative context guidance", () => {
    const result = evaluateCompatibility(
      fixtureHardware.gpu,
      fixtureModel,
      fixtureModel.quantizations[0],
    );
    expect(result.contextGuidance).toMatchObject({
      status: "available",
      modelMaximumContextLength: 8192,
      recommendedContextLength: 4096,
      confidence: "medium",
    });
    expect(result.contextGuidance.reasonCodes).toEqual([
      "model-context-limit",
      "conservative-context-guidance",
      "approximate-context-assumption",
    ]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "Context guidance is conservative and advisory; it does not calculate KV-cache memory.",
      ]),
    );
  });

  it.each([
    ["gpu-capable", fixtureHardware.gpu],
    ["partial-offload", fixtureHardware.lowMemory],
    ["cpu-only", fixtureHardware.cpuOnly],
    [
      "integrated-gpu",
      {
        ...fixtureHardware.cpuOnly,
        gpu: {
          id: "integrated",
          name: "Integrated",
          kind: "integrated" as const,
          vramGiB: 0,
          sharedMemoryGiB: 8,
        },
      },
    ],
    ["unsupported", { ...fixtureHardware.gpu, systemRamGiB: 1 }],
  ])("keeps context guidance stable for %s", (_label, hardware) => {
    const result = evaluateCompatibility(
      hardware,
      fixtureModel,
      fixtureModel.quantizations[0],
    );
    expect(result.contextGuidance.status).toBe("available");
    expect(result.contextGuidance.recommendedContextLength).toBe(4096);
  });

  it("reports unavailable context guidance when metadata is missing", () => {
    const model = {
      ...fixtureModel,
      defaultContextLength: undefined,
      maxContextLength: undefined,
    };
    const result = evaluateCompatibility(
      fixtureHardware.gpu,
      model,
      model.quantizations[0],
    );
    expect(result.contextGuidance).toMatchObject({
      status: "unavailable",
      modelMaximumContextLength: null,
      recommendedContextLength: null,
      confidence: "unknown",
    });
    expect(result.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining([
        "context-estimation-unavailable",
        "approximate-context-assumption",
      ]),
    );
  });

  it("reports inconsistent context limits without changing classification", () => {
    const model = {
      ...fixtureModel,
      defaultContextLength: 8192,
      maxContextLength: 4096,
    };
    const result = evaluateCompatibility(
      fixtureHardware.gpu,
      model,
      model.quantizations[0],
    );
    expect(result.level).toBe("gpu-capable");
    expect(result.contextGuidance.status).toBe("unavailable");
    expect(result.contextGuidance.modelMaximumContextLength).toBe(4096);
  });

  it("caps practical guidance at the configured default", () => {
    const guidance = buildContextGuidance(fixtureModel, {
      ...DEFAULT_COMPATIBILITY_POLICY,
      defaultContextLength: 2048,
    });
    expect(guidance.recommendedContextLength).toBe(2048);
    expect(guidance.modelMaximumContextLength).toBe(8192);
  });
});

describe("Apple unified-memory assessment", () => {
  const model = { ...fixtureModel, parameterCountBillions: 8 };
  const apple = (total: number): HardwareProfile => ({
    cpu: { name: "Apple M4" },
    memoryMode: "apple-unified",
    systemRamGiB: total,
    operatingSystem: "macos",
  });
  it.each([0, 0.25])(
    "counts fallback weights, overhead, reserve and margin once (%s)",
    (margin) => {
      const policy = {
        ...DEFAULT_COMPATIBILITY_POLICY,
        availableMemorySafetyMarginGiB: margin,
      };
      const required = 6.922325134277344;
      for (const [delta, level] of [
        [-0.000001, "unsupported"],
        [0, "unified-memory-fit"],
        [0.000001, "unified-memory-fit"],
      ] as const) {
        const result = evaluateCompatibility(
          apple(required + margin + delta),
          model,
          model.quantizations[0],
          policy,
        );
        expect(result.level).toBe(level);
        expect(result.memory.estimatedUnifiedMemoryGiB).toBeCloseTo(
          required,
          12,
        );
        expect(result.memory.modelWeightsGiB).toBeCloseTo(
          3.725290298461914,
          12,
        );
        expect(result.memory.estimatedVramGiB).toBeNull();
        expect(result.executionMode).toBe(
          level === "unsupported" ? "unsupported" : "unverified",
        );
        expect(
          result.reasons.some((r) => r.code === "exact-memory-boundary"),
        ).toBe(delta === 0);
        expect(result.reasons.some((r) => r.code === "no-discrete-gpu")).toBe(
          false,
        );
        expect(result.warnings.join(" ")).toMatch(
          /does not guarantee full GPU offload/,
        );
      }
    },
  );
  it("keeps supplied sizes authoritative with and without bpw, despite identical display rounding", () => {
    for (const bitsPerWeight of [undefined, 16]) {
      const quantization = {
        id: "source",
        displayName: "Source",
        sizeGiB: 5.0001,
        bitsPerWeight,
        provenance: fixtureProvenance,
      };
      const sized = { ...model, quantizations: [quantization] };
      const below = evaluateCompatibility(apple(8.35), sized, quantization);
      const above = evaluateCompatibility(apple(8.351), sized, quantization);
      expect(below.level).toBe("unsupported");
      expect(above.level).toBe("unified-memory-fit");
      expect(below.memory.estimatedUnifiedMemoryGiB).toBeCloseTo(8.350112, 12);
      expect(below.memory.modelWeightsGiB).toBe(5.0001);
    }
  });
  it.each(["openai-gpt-oss-20b", "openai-gpt-oss-120b"])(
    "supports sourced-size GPT-OSS %s without fabricating bpw or VRAM",
    (id) => {
      const sourced = getModelById(id)!;
      const quantization = sourced.quantizations[0];
      expect(quantization.bitsPerWeight).toBeUndefined();
      const result = evaluateCompatibility(apple(128), sourced, quantization);
      expect(result.level).toBe("unified-memory-fit");
      expect(result.memory.modelWeightsGiB).toBe(quantization.sizeGiB);
      expect(result.memory.estimatedUnifiedMemoryGiB).toBe(
        quantization.sizeGiB! * 1.12 + 0.75 + 2,
      );
      expect(result.memory.estimatedVramGiB).toBeNull();
    },
  );
  it("never infers Apple semantics from macOS or integrated graphics", () => {
    for (const hardware of [
      fixtureHardware.cpuOnly,
      {
        ...fixtureHardware.cpuOnly,
        gpu: {
          id: "integrated",
          name: "Integrated",
          kind: "integrated" as const,
          vramGiB: 0,
          sharedMemoryGiB: 999,
        },
      },
    ]) {
      const legacy = { ...hardware, operatingSystem: "macos" as const };
      const before = evaluateCompatibility(
        legacy,
        model,
        model.quantizations[0],
      );
      expect(
        evaluateCompatibility(
          { ...legacy, memoryMode: "pc" },
          model,
          model.quantizations[0],
        ),
      ).toEqual(before);
      expect(before.level).toBe("cpu-only");
      expect(before.memory.estimatedUnifiedMemoryGiB).toBeUndefined();
    }
    expect(() =>
      evaluateCompatibility(
        { ...apple(16), gpu: fixtureHardware.gpu.gpu },
        model,
        model.quantizations[0],
      ),
    ).toThrow(/separate GPU allocation/);
  });
});

it("uses Apple metadata, pooled-memory and quantization-ID ties without changing PC input ties", () => {
  const quantization = (id: string, sizeGiB: number) => ({
    ...fixtureModel.quantizations[0],
    id,
    sizeGiB,
  });
  const model = {
    ...fixtureModel,
    quantizations: [
      quantization("z-large", 3),
      quantization("z-small", 2),
      quantization("a-small", 2),
    ],
  };
  expect(
    recommendQuantization(fixtureHardware.cpuOnly, model)
      ?.recommendedQuantizationId,
  ).toBe("z-large");
  expect(
    recommendQuantization(
      {
        ...fixtureHardware.cpuOnly,
        memoryMode: "apple-unified",
        operatingSystem: "macos",
      },
      model,
    )?.recommendedQuantizationId,
  ).toBe("a-small");
});
