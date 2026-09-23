import { describe, expect, it } from "vitest";
import { fixtureGpus, fixtureModel } from "./fixtures";
import { productionGpus, productionModels } from "./production-catalog";
import {
  getGpuById,
  getGpuBySlug,
  getModelById,
  getModelBySlug,
  validateModelCatalogEntry,
  validateUniqueQuantizationIds,
  validateCatalog,
  validateCatalogEntries,
} from "./catalog";
import { gpuDefinitionSchema, modelDefinitionSchema } from "@/domain/schemas";

describe("catalog registry", () => {
  it("validates fixtures and retrieves entries by stable ID", () => {
    expect(() => validateCatalog()).not.toThrow();
    expect(getModelById(productionModels[0].id)).toEqual(productionModels[0]);
    expect(getGpuById(productionGpus[0].id)).toEqual(productionGpus[0]);
    expect(getModelBySlug(productionModels[0].slug)).toEqual(
      productionModels[0],
    );
    expect(getGpuBySlug(productionGpus[0].slug)).toEqual(productionGpus[0]);
    expect(getModelById("missing")).toBeUndefined();
    expect(getModelBySlug("example-7b-instruct")).toBeUndefined();
    expect(getGpuBySlug("example-12gb-gpu")).toBeUndefined();
  });

  it("keeps the production catalog real, sourced, and separate from fixtures", () => {
    expect(productionModels).toHaveLength(16);
    expect(productionGpus).toHaveLength(21);
    expect(
      productionModels.every((model) => !model.id.startsWith("example-")),
    ).toBe(true);
    expect(productionGpus.every((gpu) => !gpu.id.startsWith("gpu-"))).toBe(
      true,
    );
    for (const model of productionModels) {
      expect(model.provenance.sourceUrl).toMatch(/^https:\/\//);
      expect(model.provenance.sourceType).not.toBe("curated-estimate");
      for (const quantization of model.quantizations) {
        expect(quantization.provenance.sourceUrl).toMatch(/^https:\/\//);
      }
    }
    for (const gpu of productionGpus) {
      expect(gpu.provenance.sourceUrl).toMatch(/^https:\/\//);
      expect(gpu.provenance.sourceType).toBe("manufacturer-specification");
      if (gpu.memoryType) expect(gpu.kind).toBe("discrete");
    }
  });

  it("curates the additional models with separate publisher and GGUF provenance", () => {
    const addedModelIds = [
      "qwen-qwen3-4b",
      "qwen-qwen3-8b",
      "qwen-qwen2-5-coder-7b-instruct",
      "meta-llama-3-1-8b-instruct",
      "google-gemma-3-12b-it",
      "google-gemma-3-27b-it",
      "microsoft-phi-4-mini-instruct",
      "mistralai-mistral-nemo-12b-instruct-2407",
    ];
    const addedModels = addedModelIds.map((id) => {
      const entry = productionModels.find((model) => model.id === id);
      expect(entry).toBeDefined();
      return entry!;
    });

    for (const entry of addedModels) {
      expect(entry.provenance.sourceType).toBe("official-model-card");
      expect(entry.provenance.sourceUrl).toMatch(/^https:\/\//);
      expect(entry.license).toBeTruthy();
      expect(entry.maxContextLength).toBeGreaterThan(0);
      expect(entry.defaultContextLength).toBeUndefined();
      expect(entry.quantizations[0].id).toBe("q4-k-m");
      if (entry.id === "google-gemma-3-12b-it") {
        expect(entry.quantizations).toHaveLength(1);
      } else {
        expect(
          entry.quantizations.map((quantization) => quantization.id),
        ).toEqual(["q4-k-m", "q8-0"]);
      }
      for (const quantization of entry.quantizations) {
        expect(quantization.provenance.sourceType).toBe("community-conversion");
        expect(quantization.provenance.confidence).toBe("approximate");
        expect(quantization.provenance.sourceUrl).toMatch(
          /^https:\/\/huggingface\.co\//,
        );
      }
    }
  });

  it("includes sourced newer, established, and integrated GPU classes", () => {
    const expected = [
      ["nvidia-rtx-2060-6gb", 6, "GDDR6"],
      ["nvidia-rtx-4060-ti-16gb", 16, "GDDR6"],
      ["nvidia-rtx-4070-ti-super-16gb", 16, "GDDR6X"],
      ["nvidia-rtx-5080-16gb", 16, "GDDR7"],
      ["amd-radeon-rx-6600-8gb", 8, "GDDR6"],
      ["amd-radeon-rx-7700-xt-12gb", 12, "GDDR6"],
      ["amd-radeon-rx-9070-16gb", 16, "GDDR6"],
      ["amd-radeon-rx-9070-xt-16gb", 16, "GDDR6"],
      ["intel-arc-b570-10gb", 10, "GDDR6"],
      ["intel-arc-b580-12gb", 12, "GDDR6"],
    ] as const;
    for (const [id, vramGiB, memoryType] of expected) {
      const gpu = productionGpus.find((entry) => entry.id === id);
      expect(gpu?.vramGiB).toBe(vramGiB);
      expect(gpu?.memoryType).toBe(memoryType);
      expect(gpu?.provenance.sourceType).toBe("manufacturer-specification");
    }
    const integrated = productionGpus.find(
      (gpu) => gpu.id === "amd-radeon-780m-integrated",
    );
    expect(integrated?.kind).toBe("integrated");
    expect(integrated?.vramGiB).toBe(0);
    expect(integrated?.sharedMemoryGiB).toBeUndefined();
  });

  it("records the documented Gemma 3 1B context limit", () => {
    const gemma = productionModels.find(
      (model) => model.id === "google-gemma-3-1b-it",
    );
    expect(gemma?.maxContextLength).toBe(32768);
    expect(gemma?.provenance.lastVerified).toBe("2026-09-23");
  });

  it("rejects duplicate IDs", () => {
    expect(() =>
      validateCatalogEntries(
        "GPU",
        [fixtureGpus[0], fixtureGpus[0]],
        gpuDefinitionSchema,
      ),
    ).toThrow("Duplicate GPU catalog ID");
  });

  it("rejects malformed catalog entries", () => {
    expect(() =>
      validateCatalogEntries(
        "GPU",
        [{ ...fixtureGpus[0], vramGiB: -1 }],
        gpuDefinitionSchema,
      ),
    ).toThrow("Invalid GPU catalog entry");
  });

  it("rejects non-HTTPS provenance URLs and invalid quantization widths", () => {
    expect(
      gpuDefinitionSchema.safeParse({
        ...fixtureGpus[0],
        provenance: {
          ...fixtureGpus[0].provenance,
          sourceUrl: "http://example.com",
        },
      }).success,
    ).toBe(false);
    expect(
      modelDefinitionSchema.safeParse({
        ...fixtureModel,
        quantizations: [
          { ...fixtureModel.quantizations[0], bitsPerWeight: 17 },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate slugs and duplicate quantizations", () => {
    expect(() =>
      validateCatalogEntries(
        "model",
        [fixtureModel, { ...fixtureModel, id: "other-model" }],
        modelDefinitionSchema,
      ),
    ).toThrow("Duplicate model catalog slug");
    expect(() =>
      validateUniqueQuantizationIds({
        ...fixtureModel,
        quantizations: [
          fixtureModel.quantizations[0],
          fixtureModel.quantizations[0],
        ],
      }),
    ).toThrow("Duplicate quantization ID");
  });

  it("rejects invalid model context metadata", () => {
    expect(() =>
      validateModelCatalogEntry({
        ...fixtureModel,
        defaultContextLength: 8192,
        maxContextLength: 4096,
      }),
    ).toThrow("maximum context");
  });

  it("allows incomplete context metadata for entries with unavailable guidance", () => {
    expect(() =>
      validateModelCatalogEntry({
        ...fixtureModel,
        defaultContextLength: undefined,
        maxContextLength: undefined,
      }),
    ).not.toThrow();
    expect(() =>
      validateModelCatalogEntry({
        ...fixtureModel,
        defaultContextLength: undefined,
      }),
    ).not.toThrow();
  });
});
