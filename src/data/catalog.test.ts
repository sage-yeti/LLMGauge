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
    expect(productionModels).toHaveLength(27);
    expect(productionGpus).toHaveLength(30);
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
      "deepseek-r1-distill-qwen-1-5b",
      "qwen-qwen3-5-2b",
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

  it("records the Batch 22 model facts, licenses, contexts, and verified conversions", () => {
    const expected = [
      ["qwen-qwen3-14b", 14.8, 32768, "Apache-2.0", "Qwen/Qwen3-14B"],
      ["qwen-qwen3-32b", 32.8, 32768, "Apache-2.0", "Qwen/Qwen3-32B"],
      [
        "mistralai-mistral-small-3-2-24b-instruct-2506",
        24,
        131072,
        "Apache-2.0",
        "https://docs.mistral.ai/models/mistral-small-3-2-25-06",
      ],
      [
        "meta-llama-3-3-70b-instruct",
        70,
        131072,
        "Llama 3.3 Community License",
        "meta-llama/Llama-3.3-70B-Instruct",
      ],
    ] as const;

    for (const [id, parameters, maxContext, license, sourcePath] of expected) {
      const entry = productionModels.find((model) => model.id === id);
      expect(entry?.parameterCountBillions).toBe(parameters);
      expect(entry?.maxContextLength).toBe(maxContext);
      expect(entry?.defaultContextLength).toBeUndefined();
      expect(entry?.license).toBe(license);
      expect(entry?.provenance.sourceUrl).toBe(
        sourcePath.startsWith("https://")
          ? sourcePath
          : `https://huggingface.co/${sourcePath}`,
      );
      expect(entry?.provenance.lastVerified).toBe("2026-09-24");
      expect(
        entry?.quantizations.map((quantization) => quantization.id),
      ).toEqual(["q4-k-m", "q8-0"]);
      for (const quantization of entry?.quantizations ?? []) {
        expect(quantization.provenance.sourceType).toBe("community-conversion");
        expect(quantization.provenance.source).toContain("GGUF repository");
        expect(quantization.provenance.sourceUrl).toContain(
          "huggingface.co/bartowski/",
        );
        expect(quantization.provenance.lastVerified).toBe("2026-09-24");
      }
    }
  });

  it("records Batch 24 small-model facts and keeps estimates distinct from files", () => {
    const expected = [
      [
        "deepseek-r1-distill-qwen-1-5b",
        1.5,
        131072,
        "MIT",
        "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
        "bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF",
      ],
      [
        "qwen-qwen3-5-2b",
        2,
        262144,
        "Apache-2.0",
        "Qwen/Qwen3.5-2B",
        "unsloth/Qwen3.5-2B-GGUF",
      ],
    ] as const;

    for (const [
      id,
      parameters,
      maxContext,
      license,
      publisher,
      converter,
    ] of expected) {
      const entry = productionModels.find((model) => model.id === id);
      expect(entry?.parameterCountBillions).toBe(parameters);
      expect(entry?.maxContextLength).toBe(maxContext);
      expect(entry?.defaultContextLength).toBeUndefined();
      expect(entry?.license).toBe(license);
      expect(entry?.provenance.sourceType).toBe("official-model-card");
      expect(entry?.provenance.sourceUrl).toBe(
        `https://huggingface.co/${publisher}`,
      );
      expect(entry?.provenance.lastVerified).toBe("2026-09-25");
      if (id === "deepseek-r1-distill-qwen-1-5b") {
        expect(entry?.provenance.note).toContain("Qwen2.5 base-model license");
      }
      expect(
        entry?.quantizations.map((quantization) => quantization.id),
      ).toEqual(["q4-k-m", "q8-0"]);
      for (const quantization of entry?.quantizations ?? []) {
        expect(quantization.provenance.sourceType).toBe("community-conversion");
        expect(quantization.provenance.sourceUrl).toBe(
          `https://huggingface.co/${converter}`,
        );
        expect(quantization.provenance.lastVerified).toBe("2026-09-25");
      }
    }

    expect(
      productionModels.find((model) => model.id === "qwen-qwen3-5-2b")?.summary,
    ).toContain("vision processing");
  });

  it("records Batch 28 publisher facts and verified GGUF file-size candidates", () => {
    const expected = [
      {
        id: "qwen-qwen3-5-0-8b",
        parameters: 0.8,
        publisher: "Qwen/Qwen3.5-0.8B",
        converter: "ggml-org/Qwen3.5-0.8B-GGUF",
        quants: [
          ["Q4_0", "Qwen3.5-0.8B-Q4_0.gguf", 0.52, 4.5, "563 MB"],
          ["Q8_0", "Qwen3.5-0.8B-Q8_0.gguf", 0.78, 8, "834 MB"],
        ],
      },
      {
        id: "qwen-qwen3-5-4b",
        parameters: 4,
        publisher: "Qwen/Qwen3.5-4B",
        converter: "bartowski/Qwen_Qwen3.5-4B-GGUF",
        quants: [
          ["Q4_K_M", "Qwen3.5-4B-Q4_K_M.gguf", 2.8, 4.5, "3.01 GB"],
          ["Q8_0", "Qwen3.5-4B-Q8_0.gguf", 4.3, 8, "4.62 GB"],
        ],
      },
      {
        id: "qwen-qwen3-5-9b",
        parameters: 9,
        publisher: "Qwen/Qwen3.5-9B",
        converter: "bartowski/Qwen_Qwen3.5-9B-GGUF",
        quants: [
          ["Q4_K_M", "Qwen3.5-9B-Q4_K_M.gguf", 5.75, 4.5, "6.17 GB"],
          ["Q8_0", "Qwen3.5-9B-Q8_0.gguf", 9.13, 8, "9.80 GB"],
        ],
      },
      {
        id: "qwen-qwen3-8-27b",
        parameters: 27,
        publisher: "Qwen/Qwen3.8-27B",
        converter: "ggml-org/Qwen3.8-27B-GGUF",
        quants: [
          ["Q4_K_M", "Qwen3.8-27B-Q4_K_M.gguf", 17.69, 4.5, "19 GB"],
          ["Q8_0", "Qwen3.8-27B-Q8_0.gguf", 26.64, 8, "28.6 GB"],
        ],
      },
    ] as const;

    for (const modelFacts of expected) {
      const entry = productionModels.find(
        (model) => model.id === modelFacts.id,
      );
      expect(entry?.parameterCountBillions).toBe(modelFacts.parameters);
      expect(entry?.maxContextLength).toBe(262144);
      expect(entry?.defaultContextLength).toBeUndefined();
      expect(entry?.license).toBe("Apache-2.0");
      expect(entry?.provenance.sourceType).toBe("official-model-card");
      expect(entry?.provenance.sourceUrl).toBe(
        `https://huggingface.co/${modelFacts.publisher}`,
      );
      expect(entry?.provenance.lastVerified).toBe("2026-09-27");
      expect(entry?.quantizations.map((quant) => quant.displayName)).toEqual(
        modelFacts.quants.map(([name]) => name),
      );
      for (const [
        index,
        [, file, sizeGiB, bitsPerWeight, listedFileSize],
      ] of modelFacts.quants.entries()) {
        const quant = entry?.quantizations[index];
        expect(quant?.bitsPerWeight).toBe(bitsPerWeight);
        expect(quant?.sizeGiB).toBe(sizeGiB);
        expect(quant?.provenance.sourceType).toBe("community-conversion");
        expect(quant?.provenance.sourceUrl).toBe(
          `https://huggingface.co/${modelFacts.converter}/blob/main/${file}`,
        );
        expect(quant?.provenance.confidence).toBe("approximate");
        expect(quant?.provenance.lastVerified).toBe("2026-09-27");
        expect(quant?.description).toContain(file);
        expect(quant?.description).toContain(listedFileSize);
      }
    }
  });

  it("records Bonsai 2 packings, source provenance, and its runtime prerequisite", () => {
    const entry = productionModels.find(
      (model) => model.id === "prismml-bonsai-2-27b",
    );
    expect(entry).toBeDefined();
    expect(entry?.parameterCountBillions).toBe(27.36);
    expect(entry?.maxContextLength).toBe(262144);
    expect(entry?.license).toBe("Apache-2.0");
    expect(entry?.provenance.sourceType).toBe("official-model-card");
    expect(entry?.provenance.sourceUrl).toBe(
      "https://huggingface.co/prism-ml/Ternary-Bonsai-2-27B-gguf",
    );
    expect(entry?.runtimeRequirement?.sourceUrl).toBe(
      "https://github.com/PrismML-Eng/Bonsai-demo",
    );
    expect(entry?.runtimeRequirement?.description).toMatch(
      /PrismML's llama\.cpp fork/,
    );
    expect(entry?.runtimeRequirement?.description).toMatch(/Stock llama\.cpp/);
    expect(
      entry?.quantizations.map(
        ({ id, displayName, bitsPerWeight, sizeGiB }) => [
          id,
          displayName,
          bitsPerWeight,
          sizeGiB,
        ],
      ),
    ).toEqual([
      ["ptq1-0", "PTQ1_0", 1.75, 5.54],
      ["pq2-0", "PQ2_0", 2.13, 6.72],
    ]);
    for (const quantization of entry?.quantizations ?? []) {
      expect(quantization.provenance.sourceType).toBe("official-model-card");
      expect(quantization.provenance.sourceUrl).toBe(
        entry?.provenance.sourceUrl,
      );
      expect(quantization.description).toMatch(/vision projector/);
    }
  });

  it("includes sourced newer, established, and integrated GPU classes", () => {
    const expected = [
      ["nvidia-rtx-2060-6gb", 6, "GDDR6"],
      ["nvidia-rtx-4060-ti-16gb", 16, "GDDR6"],
      ["nvidia-rtx-4070-ti-super-16gb", 16, "GDDR6X"],
      ["nvidia-rtx-5080-16gb", 16, "GDDR7"],
      ["nvidia-rtx-5060-ti-16gb", 16, "GDDR7"],
      ["nvidia-rtx-5070-12gb", 12, "GDDR7"],
      ["nvidia-rtx-5070-ti-16gb", 16, "GDDR7"],
      ["nvidia-rtx-5090-32gb", 32, "GDDR7"],
      ["amd-radeon-rx-6600-8gb", 8, "GDDR6"],
      ["amd-radeon-rx-7700-xt-12gb", 12, "GDDR6"],
      ["amd-radeon-rx-9070-16gb", 16, "GDDR6"],
      ["amd-radeon-rx-9070-xt-16gb", 16, "GDDR6"],
      ["amd-radeon-rx-9060-xt-16gb", 16, "GDDR6"],
      ["intel-arc-b570-10gb", 10, "GDDR6"],
      ["intel-arc-b580-12gb", 12, "GDDR6"],
    ] as const;
    for (const [id, vramGiB, memoryType] of expected) {
      const gpu = productionGpus.find((entry) => entry.id === id);
      expect(gpu?.vramGiB).toBe(vramGiB);
      expect(gpu?.memoryType).toBe(memoryType);
      expect(gpu?.provenance.sourceType).toBe("manufacturer-specification");
      if (
        [
          "nvidia-rtx-5060-ti-16gb",
          "nvidia-rtx-5070-12gb",
          "nvidia-rtx-5070-ti-16gb",
          "nvidia-rtx-5090-32gb",
          "amd-radeon-rx-9060-xt-16gb",
        ].includes(id)
      ) {
        expect(gpu?.kind).toBe("discrete");
        expect(gpu?.sharedMemoryGiB).toBeUndefined();
        expect(gpu?.provenance.lastVerified).toBe("2026-09-24");
        expect(gpu?.provenance.sourceUrl).toMatch(
          /^https:\/\/(?:www\.)?(?:nvidia|amd)\.com\//,
        );
      }
    }
    const integrated = productionGpus.find(
      (gpu) => gpu.id === "amd-radeon-780m-integrated",
    );
    expect(integrated?.kind).toBe("integrated");
    expect(integrated?.vramGiB).toBe(0);
    expect(integrated?.sharedMemoryGiB).toBeUndefined();
  });

  it("records Batch 24 GPU memory variants from manufacturer specifications", () => {
    const expected = [
      ["nvidia-rtx-5060-8gb", 8, "GDDR7", "Blackwell"],
      ["nvidia-rtx-5060-ti-8gb", 8, "GDDR7", "Blackwell"],
      ["amd-radeon-rx-7600-xt-16gb", 16, "GDDR6", "RDNA 3"],
      ["amd-radeon-rx-9060-xt-8gb", 8, "GDDR6", "RDNA 4"],
    ] as const;

    for (const [id, vramGiB, memoryType, architecture] of expected) {
      const gpu = productionGpus.find((entry) => entry.id === id);
      expect(gpu?.kind).toBe("discrete");
      expect(gpu?.vramGiB).toBe(vramGiB);
      expect(gpu?.memoryType).toBe(memoryType);
      expect(gpu?.architecture).toBe(architecture);
      expect(gpu?.sharedMemoryGiB).toBeUndefined();
      expect(gpu?.provenance.sourceType).toBe("manufacturer-specification");
      expect(gpu?.provenance.lastVerified).toBe("2026-09-25");
      expect(gpu?.provenance.sourceUrl).toMatch(/^https:\/\//);
    }
  });

  it("records the documented Gemma 3 1B context limit", () => {
    const gemma = productionModels.find(
      (model) => model.id === "google-gemma-3-1b-it",
    );
    expect(gemma?.maxContextLength).toBe(32768);
    expect(gemma?.provenance.lastVerified).toBe("2026-09-23");
  });

  it("records excluded or unverified auxiliary vision files only for affected models", () => {
    const expected: Record<string, "excluded" | "unverified"> = {
      "google-gemma-3-1b-it": "unverified",
      "google-gemma-3-4b-it": "excluded",
      "google-gemma-3-12b-it": "excluded",
      "google-gemma-3-27b-it": "excluded",
      "mistralai-mistral-small-3-2-24b-instruct-2506": "excluded",
      "qwen-qwen3-5-2b": "excluded",
      "qwen-qwen3-5-0-8b": "unverified",
      "qwen-qwen3-5-4b": "excluded",
      "qwen-qwen3-5-9b": "excluded",
      "qwen-qwen3-8-27b": "excluded",
      "prismml-bonsai-2-27b": "excluded",
    };

    for (const [id, status] of Object.entries(expected)) {
      const entry = productionModels.find((model) => model.id === id);
      expect(entry?.memoryEstimateScope?.auxiliaryVisionFiles).toBe(status);
      expect(entry?.memoryEstimateScope?.sourceUrl).toMatch(/^https:\/\//);
      expect(entry?.memoryEstimateScope?.source).toBeTruthy();
    }

    const textOnly = productionModels.find(
      (model) => model.id === "meta-llama-3-2-1b-instruct",
    );
    expect(textOnly?.memoryEstimateScope).toBeUndefined();
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
