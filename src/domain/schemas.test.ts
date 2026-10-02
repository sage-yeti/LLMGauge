import { describe, expect, it } from "vitest";
import {
  fixtureHardware,
  fixtureModel,
  fixtureProvenance,
} from "@/data/fixtures";
import {
  gpuDefinitionSchema,
  hardwareProfileSchema,
  modelDefinitionSchema,
  quantizationSchema,
  runtimeProfileSchema,
} from "./schemas";

describe("domain schemas", () => {
  it.each([
    { bitsPerWeight: 4 },
    { sizeGiB: 5 },
    { bitsPerWeight: 8, sizeGiB: 5 },
  ])("accepts quantization sizing inputs %j", (sizing) => {
    expect(
      quantizationSchema.safeParse({
        ...fixtureModel.quantizations[0],
        bitsPerWeight: undefined,
        ...sizing,
      }).success,
    ).toBe(true);
  });

  it.each([0, -1, NaN, Infinity, -Infinity, 16.01])(
    "rejects invalid supplied bits per weight %s even with a valid file size",
    (bitsPerWeight) => {
      for (const sizeGiB of [undefined, 5]) {
        expect(
          quantizationSchema.safeParse({
            ...fixtureModel.quantizations[0],
            bitsPerWeight,
            sizeGiB,
          }).success,
        ).toBe(false);
      }
    },
  );

  it.each([0, -1, NaN, Infinity, -Infinity])(
    "rejects invalid supplied file size %s even with valid bits per weight",
    (sizeGiB) => {
      expect(
        quantizationSchema.safeParse({
          ...fixtureModel.quantizations[0],
          sizeGiB,
        }).success,
      ).toBe(false);
    },
  );

  it("requires at least one usable quantization sizing input", () => {
    expect(
      quantizationSchema.safeParse({
        ...fixtureModel.quantizations[0],
        bitsPerWeight: undefined,
        sizeGiB: undefined,
      }).success,
    ).toBe(false);
  });

  it("accept the representative valid contracts", () => {
    expect(hardwareProfileSchema.safeParse(fixtureHardware.gpu).success).toBe(
      true,
    );
    expect(modelDefinitionSchema.safeParse(fixtureModel).success).toBe(true);
  });

  it("validates sourced KV-cache architecture metadata as positive integers", () => {
    const kvCacheMetadata = {
      transformerLayers: 32,
      keyValueHeads: 8,
      headDimension: 128,
      provenance: fixtureProvenance,
    };
    expect(
      modelDefinitionSchema.safeParse({ ...fixtureModel, kvCacheMetadata })
        .success,
    ).toBe(true);
    expect(
      modelDefinitionSchema.safeParse({
        ...fixtureModel,
        kvCacheMetadata: { ...kvCacheMetadata, keyValueHeads: 0 },
      }).success,
    ).toBe(false);
    expect(
      modelDefinitionSchema.safeParse({
        ...fixtureModel,
        kvCacheMetadata: { ...kvCacheMetadata, headDimension: 128.5 },
      }).success,
    ).toBe(false);
  });

  it("reject zero system RAM and negative memory values", () => {
    expect(
      hardwareProfileSchema.safeParse({
        ...fixtureHardware.cpuOnly,
        systemRamGiB: 0,
      }).success,
    ).toBe(false);
    expect(
      hardwareProfileSchema.safeParse({
        ...fixtureHardware.cpuOnly,
        systemRamGiB: -1,
      }).success,
    ).toBe(false);
  });

  it("allows an integrated GPU with zero dedicated VRAM", () => {
    expect(
      gpuDefinitionSchema.safeParse({
        id: "igpu",
        slug: "igpu",
        displayName: "Integrated",
        kind: "integrated",
        vendor: "Example",
        vramGiB: 0,
        sharedMemoryGiB: 4,
        suitabilitySummary: "Shared-memory fixture GPU.",
        provenance: fixtureProvenance,
      }).success,
    ).toBe(true);
  });

  it("rejects malformed model metadata and quantizations", () => {
    expect(
      modelDefinitionSchema.safeParse({ ...fixtureModel, id: "" }).success,
    ).toBe(false);
    expect(
      modelDefinitionSchema.safeParse({
        ...fixtureModel,
        quantizations: [{ ...fixtureModel.quantizations[0], bitsPerWeight: 0 }],
      }).success,
    ).toBe(false);
  });

  it("validates optional auxiliary vision-file estimate scope metadata", () => {
    expect(
      modelDefinitionSchema.safeParse({
        ...fixtureModel,
        memoryEstimateScope: {
          auxiliaryVisionFiles: "unverified",
          source: "Model card",
          sourceUrl: "https://example.com/model-card",
        },
      }).success,
    ).toBe(true);
    expect(
      modelDefinitionSchema.safeParse({
        ...fixtureModel,
        memoryEstimateScope: {
          auxiliaryVisionFiles: "included",
          source: "Model card",
          sourceUrl: "https://example.com/model-card",
        },
      }).success,
    ).toBe(false);
    expect(
      modelDefinitionSchema.safeParse({
        ...fixtureModel,
        memoryEstimateScope: {
          auxiliaryVisionFiles: "excluded",
          source: "Model card",
          sourceUrl: "http://example.com/model-card",
        },
      }).success,
    ).toBe(false);
    expect(modelDefinitionSchema.safeParse(fixtureModel).success).toBe(true);
  });

  it("requires URL-safe slugs and well-formed provenance", () => {
    expect(
      modelDefinitionSchema.safeParse({
        ...fixtureModel,
        slug: "Not URL Safe",
      }).success,
    ).toBe(false);
    expect(
      modelDefinitionSchema.safeParse({
        ...fixtureModel,
        provenance: { ...fixtureModel.provenance, lastVerified: "yesterday" },
      }).success,
    ).toBe(false);
  });

  it("accepts optional runtime profiles and rejects invalid values", () => {
    expect(
      runtimeProfileSchema.safeParse({
        runtime: "llama.cpp",
        backend: "cuda",
        executionPreference: "full-gpu",
        targetContextLength: 4096,
      }).success,
    ).toBe(true);
    expect(runtimeProfileSchema.safeParse({}).success).toBe(true);
    expect(
      runtimeProfileSchema.safeParse({ backend: "directml" }).success,
    ).toBe(false);
    expect(
      runtimeProfileSchema.safeParse({ targetContextLength: 0 }).success,
    ).toBe(false);
    expect(
      runtimeProfileSchema.safeParse({ targetContextLength: 4096.5 }).success,
    ).toBe(false);
  });
});

describe("explicit Apple memory contract", () => {
  const apple = {
    cpu: { name: "Apple M4" },
    memoryMode: "apple-unified",
    systemRamGiB: 16,
    operatingSystem: "macos",
  };
  it("accepts explicit Apple and preserves omitted/explicit PC modes", () => {
    expect(hardwareProfileSchema.safeParse(apple).success).toBe(true);
    expect(hardwareProfileSchema.safeParse(fixtureHardware.gpu).success).toBe(
      true,
    );
    expect(
      hardwareProfileSchema.safeParse({
        ...fixtureHardware.gpu,
        memoryMode: "pc",
      }).success,
    ).toBe(true);
  });
  it.each([
    { operatingSystem: "windows" },
    { operatingSystem: "linux" },
    { memoryMode: "automatic" },
    { gpu: fixtureHardware.gpu.gpu },
    {
      gpu: {
        id: "shared",
        name: "Shared",
        kind: "integrated",
        vramGiB: 0,
        sharedMemoryGiB: 16,
      },
    },
    { systemRamGiB: 0 },
    { systemRamGiB: Infinity },
  ])("rejects contradictory or invalid Apple inputs %j", (patch) => {
    expect(
      hardwareProfileSchema.safeParse({ ...apple, ...patch }).success,
    ).toBe(false);
  });
});
