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
    expect(productionModels.length).toBeGreaterThanOrEqual(6);
    expect(productionGpus.length).toBeGreaterThanOrEqual(8);
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
    }
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
});
