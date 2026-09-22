import { describe, expect, it } from "vitest";
import { fixtureGpus, fixtureModel } from "./fixtures";
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
    expect(getModelById(fixtureModel.id)).toEqual(fixtureModel);
    expect(getGpuById(fixtureGpus[0].id)).toEqual(fixtureGpus[0]);
    expect(getModelBySlug(fixtureModel.slug)).toEqual(fixtureModel);
    expect(getGpuBySlug(fixtureGpus[0].slug)).toEqual(fixtureGpus[0]);
    expect(getModelById("missing")).toBeUndefined();
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
