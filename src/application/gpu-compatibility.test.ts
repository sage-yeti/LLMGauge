import { gpuCatalog, modelCatalog } from "@/data/catalog";
import { describe, expect, it } from "vitest";
import {
  evaluateGpuCompatibility,
  type GpuCompatibilityFormValues,
} from "./gpu-compatibility";
import { recommendModels } from "./recommendations";

const defaults: GpuCompatibilityFormValues = {
  modelId: "meta-llama-3-2-1b-instruct",
  systemRamGiB: "128",
  runtime: "",
  backend: "",
  executionPreference: "",
  targetContextLength: "",
};

const discreteGpus = gpuCatalog.filter((gpu) => gpu.kind === "discrete");

describe("GPU comparison application boundary", () => {
  it("evaluates multiple catalogued discrete GPUs and groups and orders them deterministically", () => {
    const reversed = [...discreteGpus].reverse();
    const first = evaluateGpuCompatibility(defaults, modelCatalog, reversed);
    const second = evaluateGpuCompatibility(
      defaults,
      modelCatalog,
      discreteGpus,
    );
    expect(
      first.groups?.flatMap((group) =>
        group.entries.map((entry) => entry.gpu.id),
      ),
    ).toEqual(
      second.groups?.flatMap((group) =>
        group.entries.map((entry) => entry.gpu.id),
      ),
    );
    expect(
      first.groups?.reduce((count, group) => count + group.entries.length, 0),
    ).toBe(discreteGpus.length);
    expect(
      first.groups?.every((group) =>
        group.entries.every((entry) => entry.result.level === group.level),
      ),
    ).toBe(true);
    expect(
      first.groups?.flatMap((group) => group.entries).every((entry) =>
        entry.gpu.kind === "discrete",
      ),
    ).toBe(true);
  });

  it("uses the existing representative quantization selection policy per GPU", () => {
    const gpu = discreteGpus[0]!;
    const evaluation = evaluateGpuCompatibility(defaults, modelCatalog, [gpu]);
    const model = modelCatalog.find(
      (candidate) => candidate.id === defaults.modelId,
    )!;
    const recommendation = recommendModels(
      {
        gpu: {
          id: gpu.id,
          name: gpu.displayName,
          kind: "discrete",
          vramGiB: gpu.vramGiB,
        },
        systemRamGiB: Number(defaults.systemRamGiB),
      },
      [model],
    );
    const expected =
      recommendation.recommendations[0] ?? recommendation.unsuitable[0];
    expect(evaluation.groups?.[0]?.entries[0]?.quantization.id).toBe(
      expected?.quantization.id,
    );
    expect(evaluation.groups?.[0]?.entries[0]?.result.memory).toEqual(
      expected?.result.memory,
    );
  });

  it("keeps explicit system RAM constant and classifies insufficient RAM", () => {
    const evaluation = evaluateGpuCompatibility(
      { ...defaults, systemRamGiB: "0.1" },
      modelCatalog,
      discreteGpus.slice(0, 3),
    );
    expect(
      evaluation.groups?.flatMap((group) => group.entries).length,
    ).toBe(3);
    expect(evaluation.groups?.map((group) => group.level)).toEqual([
      "unsupported",
    ]);
    expect(
      evaluation.groups?.[0]?.entries.every((entry) =>
        entry.result.limitingFactors.some((factor) => /system RAM/i.test(factor)),
      ),
    ).toBe(true);
  });

  it("includes explicit-context cache in fit only for known selected placement", () => {
    const gpu = discreteGpus.find((candidate) => candidate.vramGiB > 0)!;
    const modelId = "meta-llama-3-2-1b-instruct";
    const known = evaluateGpuCompatibility(
      {
        ...defaults,
        modelId,
        targetContextLength: "4096",
        runtime: "llama.cpp",
        backend: "cuda",
        executionPreference: "full-gpu",
      },
      modelCatalog,
      [gpu],
    ).groups?.[0]?.entries[0]?.result.kvCache;
    const unverified = evaluateGpuCompatibility(
      {
        ...defaults,
        modelId,
        targetContextLength: "4096",
        runtime: "llama.cpp",
        backend: "",
        executionPreference: "automatic",
      },
      modelCatalog,
      [gpu],
    ).groups?.flatMap((group) => group.entries)[0]?.result.kvCache;
    expect(known).toMatchObject({
      status: "estimated",
      placement: "vram",
      includedInFit: true,
      targetContextLength: 4096,
    });
    expect(unverified).toMatchObject({
      status: "estimated",
      placement: "unverified",
      includedInFit: false,
      targetContextLength: 4096,
    });
  });

  it("preserves unsupported architecture and over-maximum context behavior", () => {
    const gpu = discreteGpus[0]!;
    const unsupportedModel = modelCatalog.find(
      (model) => !model.kvCacheMetadata,
    )!;
    const unsupportedArchitecture = evaluateGpuCompatibility(
      {
        ...defaults,
        modelId: unsupportedModel.id,
        targetContextLength: "4096",
      },
      modelCatalog,
      [gpu],
    ).groups?.flatMap((group) => group.entries)[0]?.result.kvCache;
    expect(unsupportedArchitecture?.status).toBe("unavailable");
    expect(unsupportedArchitecture?.includedInFit).toBe(false);

    const boundedModel = modelCatalog.find(
      (model) => model.kvCacheMetadata && model.maxContextLength,
    )!;
    const tooLong = evaluateGpuCompatibility(
      {
        ...defaults,
        modelId: boundedModel.id,
        targetContextLength: String(boundedModel.maxContextLength! + 1),
      },
      modelCatalog,
      [gpu],
    ).groups?.flatMap((group) => group.entries)[0]?.result.kvCache;
    expect(tooLong?.status).toBe("unavailable");
    expect(tooLong?.reason).toMatch(/exceeds the documented model maximum/);
  });

  it("rejects blank or invalid RAM and unavailable model IDs", () => {
    expect(
      evaluateGpuCompatibility(
        { ...defaults, systemRamGiB: "" },
        modelCatalog,
        discreteGpus,
      ).fieldErrors.systemRamGiB,
    ).toBe("Enter system RAM.");
    expect(
      evaluateGpuCompatibility(
        { ...defaults, systemRamGiB: "-1" },
        modelCatalog,
        discreteGpus,
      ).fieldErrors.systemRamGiB,
    ).toBe("Enter a number greater than 0.");
    expect(
      evaluateGpuCompatibility(
        { ...defaults, modelId: "missing-model" },
        modelCatalog,
        discreteGpus,
      ).fieldErrors.modelId,
    ).toBe("Choose a model from the catalog.");
  });
});
