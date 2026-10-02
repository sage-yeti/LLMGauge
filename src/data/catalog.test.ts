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
    expect(productionModels).toHaveLength(54);
    expect(productionGpus).toHaveLength(64);
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

  it("records Meta-sourced KV-cache architecture for the three text-only Llama variants", () => {
    const expected = [
      ["meta-llama-3-2-1b-instruct", 16, 8, 64, "2048 ÷ 32 = 64"],
      ["meta-llama-3-2-3b-instruct", 28, 8, 128, "3072 ÷ 24 = 128"],
      ["meta-llama-3-3-70b-instruct", 80, 8, 128, "8192 ÷ 64 = 128"],
    ] as const;
    const sourceUrl =
      "https://github.com/meta-llama/llama-models/blob/main/models/sku_list.py";

    for (const [
      id,
      layers,
      kvHeads,
      headDimension,
      derivedDimension,
    ] of expected) {
      const entry = productionModels.find((candidate) => candidate.id === id);
      expect(entry?.kvCacheMetadata).toMatchObject({
        transformerLayers: layers,
        keyValueHeads: kvHeads,
        headDimension,
        provenance: {
          sourceUrl,
          sourceType: "official-documentation",
          confidence: "verified",
          lastVerified: "2026-10-02",
          note: expect.stringContaining(derivedDimension),
        },
      });
    }

    expect(
      productionModels.find((entry) => entry.id === "google-gemma-3-1b-it")
        ?.kvCacheMetadata,
    ).toBeUndefined();
    expect(
      productionModels.find(
        (entry) => entry.id === "meta-llama-3-1-8b-instruct",
      )?.kvCacheMetadata?.transformerLayers,
    ).toBe(32);
  });

  it("records Qwen-sourced dense Qwen3 KV-cache architecture and leaves other Qwen families unsupported", () => {
    const expected = [
      ["qwen-qwen3-4b", 36, 8, 128, "Qwen3-4B"],
      ["qwen-qwen3-8b", 36, 8, 128, "Qwen3-8B"],
      ["qwen-qwen3-14b", 40, 8, 128, "Qwen3-14B"],
      ["qwen-qwen3-32b", 64, 8, 128, "Qwen3-32B"],
    ] as const;

    for (const [id, layers, kvHeads, headDimension, modelName] of expected) {
      const entry = productionModels.find((candidate) => candidate.id === id);
      expect(entry?.kvCacheMetadata).toMatchObject({
        transformerLayers: layers,
        keyValueHeads: kvHeads,
        headDimension,
        provenance: {
          source: `Qwen ${modelName} official config.json`,
          sourceUrl: `https://huggingface.co/Qwen/${modelName}/blob/main/config.json`,
          sourceType: "official-documentation",
          confidence: "verified",
          lastVerified: "2026-10-02",
          note: expect.stringContaining("use_sliding_window=false"),
        },
      });
    }

    for (const id of [
      "qwen-qwen3-8-27b",
      "qwen-qwen3-coder-30b-a3b-instruct",
      "qwen-qwen3-coder-next",
      "qwen-qwen3-vl-8b-instruct",
      "qwen-qwen3-vl-30b-a3b-instruct",
      "qwen-qwen3-5-4b",
    ]) {
      expect(
        productionModels.find((candidate) => candidate.id === id)
          ?.kvCacheMetadata,
      ).toBeUndefined();
    }
  });

  it("records the requested GPU variants with manufacturer-backed specifications", () => {
    const expected = [
      [
        "amd-radeon-ai-pro-r9700-32gb",
        "Radeon AI PRO R9700 32GB",
        "AMD",
        "RDNA 4",
        32,
        "GDDR6",
        "amd-radeon-ai-pro-r9700.html",
      ],
      [
        "intel-arc-pro-b70-32gb",
        "Intel Arc Pro B70 32GB",
        "Intel",
        "Battlemage",
        32,
        "GDDR6",
        "sku/245797/",
      ],
      [
        "intel-arc-pro-b65-32gb",
        "Intel Arc Pro B65 32GB",
        "Intel",
        "Battlemage",
        32,
        "GDDR6",
        "sku/245796/",
      ],
      [
        "intel-arc-pro-b60-24gb",
        "Intel Arc Pro B60 24GB",
        "Intel",
        "Battlemage",
        24,
        "GDDR6",
        "sku/243916/",
      ],
      [
        "nvidia-geforce-rtx-4060-ti-8gb",
        "GeForce RTX 4060 Ti 8GB",
        "NVIDIA",
        "Ada Lovelace",
        8,
        "GDDR6",
        "rtx-4060-4060ti/",
      ],
      [
        "nvidia-geforce-rtx-4070-ti-12gb",
        "GeForce RTX 4070 Ti 12GB",
        "NVIDIA",
        "Ada Lovelace",
        12,
        "GDDR6X",
        "rtx-4070-family/",
      ],
      [
        "nvidia-geforce-rtx-4080-16gb",
        "GeForce RTX 4080 16GB",
        "NVIDIA",
        "Ada Lovelace",
        16,
        "GDDR6X",
        "rtx-4080-family/",
      ],
      [
        "nvidia-geforce-rtx-3050-8gb",
        "GeForce RTX 3050 8GB",
        "NVIDIA",
        "Ampere",
        8,
        "GDDR6",
        "rtx-3050/",
      ],
      [
        "nvidia-geforce-rtx-3050-6gb",
        "GeForce RTX 3050 6GB",
        "NVIDIA",
        "Ampere",
        6,
        "GDDR6",
        "rtx-3050/",
      ],
      [
        "nvidia-geforce-rtx-3090-ti-24gb",
        "GeForce RTX 3090 Ti 24GB",
        "NVIDIA",
        "Ampere",
        24,
        "GDDR6X",
        "rtx-3090-3090ti/",
      ],
      [
        "nvidia-geforce-rtx-3080-ti-12gb",
        "GeForce RTX 3080 Ti 12GB",
        "NVIDIA",
        "Ampere",
        12,
        "GDDR6X",
        "rtx-3080-3080ti/",
      ],
      [
        "nvidia-geforce-rtx-2080-ti-11gb",
        "GeForce RTX 2080 Ti 11GB",
        "NVIDIA",
        "Turing",
        11,
        "GDDR6",
        "rtx-2080-ti.html",
      ],
      [
        "nvidia-geforce-gtx-1080-ti-11gb",
        "GeForce GTX 1080 Ti 11GB",
        "NVIDIA",
        "Pascal",
        11,
        "GDDR5X",
        "nvidia-geforce-gtx-1080-ti/",
      ],
      [
        "nvidia-rtx-a4000-16gb",
        "NVIDIA RTX A4000 16GB",
        "NVIDIA",
        "Ampere",
        16,
        "GDDR6",
        "workstations/rtx-a4000/",
      ],
      [
        "nvidia-rtx-a5000-24gb",
        "NVIDIA RTX A5000 24GB",
        "NVIDIA",
        "Ampere",
        24,
        "GDDR6",
        "workstations/rtx-a5000/",
      ],
    ] as const;
    const byId = new Map(productionGpus.map((gpu) => [gpu.id, gpu]));

    for (const [
      id,
      displayName,
      vendor,
      architecture,
      vramGiB,
      memoryType,
      sourcePath,
    ] of expected) {
      const gpu = byId.get(id);
      expect(gpu).toBeDefined();
      expect(gpu?.slug).toBeTruthy();
      expect(gpu?.displayName).toBe(displayName);
      expect(gpu?.kind).toBe("discrete");
      expect(gpu?.vendor).toBe(vendor);
      expect(gpu?.architecture).toBe(architecture);
      expect(gpu?.vramGiB).toBe(vramGiB);
      expect(gpu?.memoryType).toBe(memoryType);
      expect(gpu?.provenance.sourceType).toBe("manufacturer-specification");
      expect(gpu?.provenance.confidence).toBe("verified");
      expect(gpu?.provenance.lastVerified).toBe("2026-10-01");
      expect(gpu?.provenance.sourceUrl).toContain(sourcePath);
      expect(gpu?.suitabilitySummary).not.toMatch(
        /benchmark|tokens per second/i,
      );
    }

    expect(byId.get("nvidia-rtx-4060-ti-16gb")?.vramGiB).toBe(16);
    expect(byId.get("nvidia-geforce-rtx-4060-ti-8gb")?.vramGiB).toBe(8);
    expect(byId.get("nvidia-geforce-rtx-3050-8gb")?.vramGiB).toBe(8);
    expect(byId.get("nvidia-geforce-rtx-3050-6gb")?.vramGiB).toBe(6);
    expect(
      [
        "intel-arc-pro-b70-32gb",
        "intel-arc-pro-b65-32gb",
        "intel-arc-pro-b60-24gb",
      ].map((id) => byId.get(id)?.vramGiB),
    ).toEqual([32, 32, 24]);
  });

  it("records the verified Batch 31 model facts, GGUF files, sizes, and separate provenance", () => {
    const expected = [
      [
        "google-gemma-4-12b-it",
        11.95,
        "7.22 GB",
        6.72,
        "gemma-4-12B-it-Q4_0.gguf",
      ],
      ["qwen-qwen3-6-27b", 27, "19.1 GB", 17.79, "Qwen3.6-27B-Q4_K_M.gguf"],
      [
        "google-gemma-4-26b-a4b-it",
        25.2,
        "16.8 GB",
        15.65,
        "gemma-4-26B-A4B-it-Q4_K_M.gguf",
      ],
      [
        "qwen-qwen3-6-35b-a3b",
        35,
        "20.4 GB",
        19.01,
        "Qwen3.6-35B-A3B-Q4_K_M.gguf",
      ],
      ["liquidai-lfm2-5-2-6b", 2.6, "1.59 GB", 1.48, "LFM2.5-2.6B-Q4_0.gguf"],
      ["google-gemma-4-e4b-it", 8, "4.59 GB", 4.28, "gemma-4-E4B-it-Q4_0.gguf"],
      [
        "meta-muse-glimmer-30b",
        30,
        "16.8 GB",
        15.65,
        "Muse-Glimmer-30B-KQuant-17GB-Q4_K_M.gguf",
      ],
      ["deepseek-v4-flash-0731", 284, "155 GB", 144.35, "00001-of-00005.gguf"],
      [
        "google-gemma-4-31b-it",
        31,
        "19.60 GB",
        18.25,
        "google_gemma-4-31B-it-Q4_K_M.gguf",
      ],
    ] as const;
    const byId = new Map(productionModels.map((entry) => [entry.id, entry]));

    for (const [id, parameters, listedSize, sizeGiB, fileName] of expected) {
      const entry = byId.get(id);
      expect(entry).toBeDefined();
      expect(entry?.parameterCountBillions).toBe(parameters);
      expect(entry?.provenance.sourceType).toBe("official-model-card");
      expect(entry?.provenance.sourceUrl).toMatch(
        /^https:\/\/huggingface\.co\//,
      );
      expect(entry?.license).toBeTruthy();
      expect(entry?.defaultContextLength).toBeUndefined();
      expect(entry?.quantizations).toHaveLength(1);
      const quantization = entry!.quantizations[0];
      expect(quantization.sizeGiB).toBe(sizeGiB);
      expect(quantization.description).toContain(listedSize);
      expect(quantization.description).toContain(fileName);
      expect(quantization.provenance.sourceUrl).toMatch(
        id === "deepseek-v4-flash-0731" ? /\/tree\/main\// : /\/blob\/main\//,
      );
      expect(quantization.provenance.sourceType).toMatch(
        /^(community|publisher)-conversion$/,
      );
      expect(quantization.provenance.lastVerified).toBe("2026-09-29");
      expect(quantization.provenance.sourceUrl).not.toBe(
        entry?.provenance.sourceUrl,
      );
    }

    expect(byId.get("google-gemma-4-26b-a4b-it")?.parameterCountBillions).toBe(
      25.2,
    );
    expect(byId.get("qwen-qwen3-6-35b-a3b")?.parameterCountBillions).toBe(35);
    expect(byId.get("google-gemma-4-e4b-it")?.parameterCountBillions).toBe(8);
    for (const id of [
      "google-gemma-4-12b-it",
      "qwen-qwen3-6-27b",
      "google-gemma-4-26b-a4b-it",
      "qwen-qwen3-6-35b-a3b",
      "google-gemma-4-e4b-it",
      "meta-muse-glimmer-30b",
      "google-gemma-4-31b-it",
    ]) {
      expect(byId.get(id)?.memoryEstimateScope?.auxiliaryVisionFiles).toBe(
        "excluded",
      );
    }
    expect(
      byId.get("liquidai-lfm2-5-2-6b")?.memoryEstimateScope,
    ).toBeUndefined();
    expect(
      byId.get("liquidai-lfm2-5-2-6b")?.quantizations[0].provenance.sourceType,
    ).toBe("publisher-conversion");
    expect(
      byId.get("meta-muse-glimmer-30b")?.quantizations[0].provenance.sourceType,
    ).toBe("publisher-conversion");
    expect(byId.has("qwen-qwen3-8-27b")).toBe(true);
    expect(byId.has("qwen-qwen3-6-27b")).toBe(true);
    expect(
      byId.get("deepseek-v4-flash-0731")?.quantizations[0].description,
    ).toContain("00005-of-00005.gguf");
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

  it("records the verified Batch 35 model facts and GGUF files in priority order", () => {
    const expected = [
      [
        "qwen-qwen3-coder-30b-a3b-instruct",
        30.5,
        "Apache-2.0",
        "Qwen/Qwen3-Coder-30B-A3B-Instruct",
        "lmstudio-community/Qwen3-Coder-30B-A3B-Instruct-GGUF",
        "Qwen3-Coder-30B-A3B-Instruct-Q4_K_M.gguf",
        "18.6 GB",
        17.32,
      ],
      [
        "qwen-qwen3-30b-a3b-instruct-2507",
        30.5,
        "Apache-2.0",
        "Qwen/Qwen3-30B-A3B-Instruct-2507",
        "bartowski/Qwen_Qwen3-30B-A3B-Instruct-2507-GGUF",
        "Qwen_Qwen3-30B-A3B-Instruct-2507-Q4_K_M.gguf",
        "18.6 GB",
        17.32,
      ],
      [
        "zai-glm-4-7-flash",
        30,
        "MIT",
        "zai-org/GLM-4.7-Flash",
        "lmstudio-community/GLM-4.7-Flash-GGUF",
        "GLM-4.7-Flash-Q4_K_M.gguf",
        "18.1 GB",
        16.86,
      ],
      [
        "qwen-qwen3-coder-next",
        80,
        "Apache-2.0",
        "Qwen/Qwen3-Coder-Next",
        "Qwen/Qwen3-Coder-Next-GGUF",
        "Qwen3-Coder-Next-Q4_K_M-00001-of-00004.gguf",
        "48.4 GB",
        45.08,
      ],
      [
        "qwen-qwen3-5-122b-a10b",
        122,
        "Apache-2.0",
        "Qwen/Qwen3.5-122B-A10B",
        "bartowski/Qwen_Qwen3.5-122B-A10B-GGUF",
        "Qwen_Qwen3.5-122B-A10B-Q4_K_M-00001-of-00002.gguf",
        "77.62 GB",
        72.29,
      ],
      [
        "google-gemma-3n-e2b-it",
        5,
        "Gemma Terms of Use",
        "ai.google.dev/gemma/docs/gemma-3n/model_card",
        "ggml-org/gemma-3n-E2B-it-GGUF",
        "gemma-3n-E2B-it-Q8_0.gguf",
        "4.79 GB",
        4.46,
      ],
      [
        "google-gemma-3n-e4b-it",
        8,
        "Gemma Terms of Use",
        "ai.google.dev/gemma/docs/gemma-3n/model_card",
        "ggml-org/gemma-3n-E4B-it-GGUF",
        "gemma-3n-E4B-it-Q8_0.gguf",
        "7.35 GB",
        6.85,
      ],
    ] as const;

    const entries = expected.map(([id]) =>
      productionModels.find((m) => m.id === id),
    );
    expect(entries.every(Boolean)).toBe(true);
    expect(entries.map((entry) => entry?.id)).toEqual(
      expected.map(([id]) => id),
    );

    for (const [index, facts] of expected.entries()) {
      const [
        id,
        parameters,
        license,
        publisher,
        converter,
        file,
        listedSize,
        sizeGiB,
      ] = facts;
      const entry = entries[index]!;
      const quantization = entry.quantizations[0];
      expect(entry.parameterCountBillions).toBe(parameters);
      expect(entry.license).toBe(license);
      expect(entry.provenance.sourceUrl).toBe(
        publisher.startsWith("https://")
          ? publisher
          : publisher.startsWith("ai.")
            ? `https://${publisher}`
            : `https://huggingface.co/${publisher}`,
      );
      expect(entry.provenance.sourceType).toBe("official-model-card");
      expect(entry.provenance.confidence).toBe("verified");
      expect(entry.provenance.lastVerified).toBe("2026-09-30");
      expect(quantization.displayName).toBe(
        id.startsWith("google-gemma-3n") ? "Q8_0" : "Q4_K_M",
      );
      expect(quantization.sizeGiB).toBe(sizeGiB);
      expect(quantization.description).toContain(file);
      expect(quantization.description).toContain(listedSize);
      expect(quantization.provenance.sourceUrl).toContain(converter);
      expect(quantization.provenance.sourceType).toMatch(
        /^(community|publisher)-conversion$/,
      );
      expect(quantization.provenance.confidence).toBe("approximate");
      expect(quantization.provenance.lastVerified).toBe("2026-09-30");
      expect(entry.defaultContextLength).toBeUndefined();
    }

    expect(entries[0]?.maxContextLength).toBe(262144);
    expect(entries[1]?.maxContextLength).toBe(262144);
    expect(entries[2]?.maxContextLength).toBeUndefined();
    expect(entries[3]?.maxContextLength).toBe(262144);
    expect(entries[4]?.maxContextLength).toBe(262144);
    for (const entry of entries.slice(0, 4)) {
      expect(entry?.memoryEstimateScope).toBeUndefined();
    }
    expect(entries[4]?.memoryEstimateScope?.auxiliaryVisionFiles).toBe(
      "unverified",
    );
    expect(entries[0]?.summary).toContain("3.3B active per token");
    expect(entries[1]?.summary).toContain("3.3B active per token");
    expect(entries[2]?.summary).toContain("activates 3B parameters per token");
    expect(entries[3]?.summary).toContain("3B active per token");
    expect(entries[4]?.summary).toContain("10B active parameters");
    for (const [index, effectiveLabel] of [
      [5, "E2B"],
      [6, "E4B"],
    ] as const) {
      const entry = entries[index]!;
      expect(entry.summary).toContain(effectiveLabel);
      expect(entry.summary).toContain(
        "multimodal runtime memory is not separately estimated",
      );
      expect(entry.parameterCountBillions).toBe(index === 5 ? 5 : 8);
      expect(entry.memoryEstimateScope?.auxiliaryVisionFiles).toBe(
        "unverified",
      );
      expect(entry.memoryEstimateScope?.sourceUrl).toBe(
        `https://huggingface.co/${expected[index][4]}`,
      );
    }
  });

  it("records GPT-OSS main-model MXFP4 artifacts without fabricated bits per weight", () => {
    for (const [variant, total, active, bytes] of [
      ["20b", 20.91, 3.61, 12109566624],
      ["120b", 116.83, 5.13, 63387346208],
    ] as const) {
      const entry = getModelById(`openai-gpt-oss-${variant}`)!;
      expect(entry.slug).toBe(`gpt-oss-${variant}`);
      expect(entry.parameterCountBillions).toBe(total);
      expect(entry.summary).toContain(`${active}B active parameters`);
      expect(entry.license).toBe("Apache-2.0");
      expect(entry.maxContextLength).toBe(131072);
      expect(entry.defaultContextLength).toBeUndefined();
      expect(entry.memoryEstimateScope).toBeUndefined();
      expect(entry.provenance).toMatchObject({
        sourceUrl: `https://huggingface.co/openai/gpt-oss-${variant}`,
        sourceType: "official-model-card",
        confidence: "verified",
        lastVerified: "2026-10-01",
      });
      expect(entry.runtimeRequirement?.description).toMatch(
        /GPT-OSS\/MXFP4 support.*Harmony/,
      );
      expect(entry.quantizations).toHaveLength(1);
      const quantization = entry.quantizations[0];
      expect(quantization).toMatchObject({
        id: "mxfp4",
        displayName: "MXFP4",
        sizeGiB: bytes / 2 ** 30,
        provenance: {
          sourceType: "community-conversion",
          confidence: "verified",
          lastVerified: "2026-10-01",
          sourceUrl: `https://huggingface.co/ggml-org/gpt-oss-${variant}-GGUF/raw/main/gpt-oss-${variant}-MXFP4.gguf`,
        },
      });
      expect(quantization.bitsPerWeight).toBeUndefined();
      expect(quantization.description).toMatch(/Separate Eagle.*excluded/);
      expect(modelDefinitionSchema.safeParse(entry).success).toBe(true);
      expect(() => validateModelCatalogEntry(entry)).not.toThrow();
    }
  });

  it("validates size-only catalog candidates and rejects invalid supplied sizing", () => {
    const base = fixtureModel.quantizations[0];
    expect(() =>
      validateUniqueQuantizationIds({
        ...fixtureModel,
        quantizations: [{ ...base, bitsPerWeight: undefined, sizeGiB: 5 }],
      }),
    ).not.toThrow();
    for (const bitsPerWeight of [0, -1, NaN, Infinity, 17]) {
      expect(() =>
        validateUniqueQuantizationIds({
          ...fixtureModel,
          quantizations: [{ ...base, bitsPerWeight, sizeGiB: 5 }],
        }),
      ).toThrow(/invalid sizing/);
    }
  });

  it("records Batch 37 models with total parameters, separate provenance, and verified GGUF files", () => {
    const expected = [
      {
        id: "qwen-qwen3-vl-8b-instruct",
        slug: "qwen3-vl-8b-instruct",
        parameters: 9,
        license: "Apache-2.0",
        publisher: "Qwen/Qwen3-VL-8B-Instruct",
        converter: "Qwen/Qwen3-VL-8B-Instruct-GGUF",
        file: "Qwen3VL-8B-Instruct-Q4_K_M.gguf",
        listedSize: "5.03 GB",
        sizeGiB: 4.68,
        sourceType: "publisher-conversion",
        context: 262144,
        vision: "excluded",
      },
      {
        id: "qwen-qwen3-vl-30b-a3b-instruct",
        slug: "qwen3-vl-30b-a3b-instruct",
        parameters: 31,
        license: "Apache-2.0",
        publisher: "Qwen/Qwen3-VL-30B-A3B-Instruct",
        converter: "Qwen/Qwen3-VL-30B-A3B-Instruct-GGUF",
        file: "Qwen3VL-30B-A3B-Instruct-Q4_K_M.gguf",
        listedSize: "18.6 GB",
        sizeGiB: 17.32,
        sourceType: "publisher-conversion",
        context: 262144,
        vision: "excluded",
      },
      {
        id: "mistralai-ministral-3-14b-instruct-2512",
        slug: "ministral-3-14b-instruct-2512",
        parameters: 13.9,
        license: "Apache-2.0",
        publisher: "mistralai/Ministral-3-14B-Instruct-2512",
        converter: "mistralai/Ministral-3-14B-Instruct-2512-GGUF",
        file: "Ministral-3-14B-Instruct-2512-Q4_K_M.gguf",
        listedSize: "8.24 GB",
        sizeGiB: 7.67,
        sourceType: "publisher-conversion",
        context: 262144,
        vision: "excluded",
      },
      {
        id: "mistralai-devstral-small-2-24b-instruct-2512",
        slug: "devstral-small-2-24b-instruct-2512",
        parameters: 24,
        license: "Apache-2.0",
        publisher: "mistralai/Devstral-Small-2-24B-Instruct-2512",
        converter: "lmstudio-community/Devstral-Small-2-24B-Instruct-2512-GGUF",
        file: "Devstral-Small-2-24B-Instruct-2512-Q4_K_M.gguf",
        listedSize: "14.3 GB",
        sizeGiB: 13.32,
        sourceType: "community-conversion",
        context: 262144,
        vision: "excluded",
      },
      {
        id: "liquidai-lfm2-24b-a2b",
        slug: "lfm2-24b-a2b",
        parameters: 24,
        license: "LFM Open License v1.0",
        publisher: "LiquidAI/LFM2-24B-A2B",
        converter: "LiquidAI/LFM2-24B-A2B-GGUF",
        file: "LFM2-24B-A2B-Q4_K_M.gguf",
        listedSize: "14.4 GB",
        sizeGiB: 13.41,
        sourceType: "publisher-conversion",
        context: 32768,
      },
      {
        id: "nvidia-nemotron-3-nano-30b-a3b",
        slug: "nemotron-3-nano-30b-a3b",
        parameters: 30,
        license: "NVIDIA Nemotron Open Model License",
        publisher: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16",
        converter: "ggml-org/NVIDIA-Nemotron-3-Nano-30B-A3B-GGUF",
        file: "NVIDIA-Nemotron-3-Nano-30B-A3B-Q4_K_M.gguf",
        listedSize: "22.4 GB",
        sizeGiB: 20.86,
        sourceType: "community-conversion",
      },
      {
        id: "mistralai-mistral-small-4-119b-2603",
        slug: "mistral-small-4-119b-2603",
        parameters: 119,
        license: "Apache-2.0",
        publisher: "mistralai/Mistral-Small-4-119B-2603",
        converter: "bartowski/mistralai_Mistral-Small-4-119B-2603-GGUF",
        file: "mistralai_Mistral-Small-4-119B-2603-Q4_K_M-00001-of-00002.gguf",
        listedSize: "72.64 GB",
        sizeGiB: 67.68,
        sourceType: "community-conversion",
        context: 262144,
        vision: "unverified",
      },
      {
        id: "nvidia-nemotron-3-super-120b-a12b",
        slug: "nemotron-3-super-120b-a12b",
        parameters: 120,
        license: "NVIDIA Nemotron Open Model License",
        publisher: "nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-BF16",
        converter: "ggml-org/Nemotron-3-Super-120B-GGUF",
        file: "Nemotron-3-Super-120B-Q4_K.gguf",
        listedSize: "69.9 GB",
        sizeGiB: 65.08,
        quantization: "Q4_K",
        sourceType: "community-conversion",
        context: 1048576,
      },
      {
        id: "poolside-laguna-s-2-1",
        slug: "laguna-s-2-1",
        parameters: 118,
        license: "OpenMDW-1.1",
        publisher: "poolside/Laguna-S-2.1",
        converter: "bartowski/Laguna-S-2.1-GGUF",
        file: "Laguna-S-2.1-Q4_K_M.gguf",
        listedSize: "71.76 GB",
        sizeGiB: 66.84,
        sourceType: "community-conversion",
        context: 1048576,
      },
    ] as const;

    const entries = expected.map((facts) =>
      productionModels.find((entry) => entry.id === facts.id),
    );
    expect(entries.every(Boolean)).toBe(true);
    expect(entries.map((entry) => entry?.slug)).toEqual(
      expected.map((facts) => facts.slug),
    );

    for (const [index, facts] of expected.entries()) {
      const entry = entries[index]!;
      const quantization = entry.quantizations[0];
      expect(entry.parameterCountBillions).toBe(facts.parameters);
      expect(entry.license).toBe(facts.license);
      expect(entry.provenance.sourceUrl).toBe(
        `https://huggingface.co/${facts.publisher}`,
      );
      expect(entry.provenance.sourceType).toBe("official-model-card");
      expect(entry.provenance.confidence).toBe("verified");
      expect(entry.provenance.lastVerified).toBe("2026-10-01");
      expect(quantization.displayName).toBe(
        "quantization" in facts ? facts.quantization : "Q4_K_M",
      );
      expect(quantization.sizeGiB).toBe(facts.sizeGiB);
      expect(quantization.description).toContain(facts.file);
      expect(quantization.description).toContain(facts.listedSize);
      expect(quantization.provenance.sourceUrl).toContain(facts.converter);
      expect(quantization.provenance.sourceType).toBe(facts.sourceType);
      expect(quantization.provenance.confidence).toBe("approximate");
      expect(quantization.provenance.lastVerified).toBe("2026-10-01");
      expect(entry.defaultContextLength).toBeUndefined();
      expect(entry.maxContextLength).toBe(
        "context" in facts ? facts.context : undefined,
      );
      expect(entry.supportedRuntimes).toContain("llama.cpp");
      if ("vision" in facts && facts.vision) {
        expect(entry.memoryEstimateScope?.auxiliaryVisionFiles).toBe(
          facts.vision,
        );
      } else {
        expect(entry.memoryEstimateScope).toBeUndefined();
      }
    }

    expect(entries[0]?.summary).toContain("9B total parameters");
    expect(entries[1]?.summary).toContain("31B total and 3B active");
    expect(entries[2]?.summary).toContain("13.9B total-parameter");
    expect(entries[4]?.summary).toContain("24B total and 2.3B active");
    expect(entries[5]?.summary).toContain("30B total and 3.5B active");
    expect(entries[6]?.summary).toContain("119B total and 6.5B active");
    expect(entries[7]?.summary).toContain("120B total and 12B active");
    expect(entries[8]?.summary).toContain("118B total and approximately 8B");
    expect(
      productionModels.filter((entry) =>
        [
          "qwen-qwen3-coder-30b-a3b-instruct",
          "qwen-qwen3-coder-next",
          "zai-glm-4-7-flash",
          "google-gemma-3n-e4b-it",
        ].includes(entry.id),
      ),
    ).toHaveLength(4);
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

  it("records Batch 32 GPU identities and manufacturer-documented specifications", () => {
    const expected = [
      [
        "nvidia-geforce-rtx-3090-24gb",
        "GeForce RTX 3090 24GB",
        24,
        "GDDR6X",
        "Ampere",
      ],
      [
        "nvidia-geforce-rtx-4070-12gb",
        "GeForce RTX 4070 12GB",
        12,
        undefined,
        "Ada Lovelace",
      ],
      [
        "nvidia-geforce-rtx-3070-8gb",
        "GeForce RTX 3070 8GB",
        8,
        "GDDR6",
        "Ampere",
      ],
      [
        "nvidia-geforce-rtx-3080-10gb",
        "GeForce RTX 3080 10GB",
        10,
        "GDDR6X",
        "Ampere",
      ],
      [
        "nvidia-geforce-rtx-3080-12gb",
        "GeForce RTX 3080 12GB",
        12,
        "GDDR6X",
        "Ampere",
      ],
      [
        "nvidia-geforce-rtx-3060-ti-8gb",
        "GeForce RTX 3060 Ti 8GB",
        8,
        undefined,
        "Ampere",
      ],
      [
        "nvidia-geforce-rtx-4080-super-16gb",
        "GeForce RTX 4080 SUPER 16GB",
        16,
        "GDDR6X",
        "Ada Lovelace",
      ],
      [
        "amd-radeon-rx-7900-xt-20gb",
        "Radeon RX 7900 XT 20GB",
        20,
        "GDDR6",
        "RDNA 3",
      ],
      ["amd-radeon-rx-6800-16gb", "Radeon RX 6800 16GB", 16, "GDDR6", "RDNA 2"],
      [
        "amd-radeon-rx-6800-xt-16gb",
        "Radeon RX 6800 XT 16GB",
        16,
        "GDDR6",
        "RDNA 2",
      ],
      [
        "amd-radeon-rx-6700-xt-12gb",
        "Radeon RX 6700 XT 12GB",
        12,
        "GDDR6",
        "RDNA 2",
      ],
      ["nvidia-tesla-p40-24gb", "NVIDIA Tesla P40 24GB", 24, "GDDR5", "Pascal"],
      ["nvidia-rtx-a6000-48gb", "NVIDIA RTX A6000 48GB", 48, "GDDR6", "Ampere"],
    ] as const;
    const byId = new Map(productionGpus.map((gpu) => [gpu.id, gpu]));

    for (const [
      id,
      displayName,
      vramGiB,
      memoryType,
      architecture,
    ] of expected) {
      const gpu = byId.get(id);
      expect(gpu).toBeDefined();
      expect(gpu?.displayName).toBe(displayName);
      expect(gpu?.kind).toBe("discrete");
      expect(gpu?.vendor).toMatch(/^(NVIDIA|AMD)$/);
      expect(gpu?.vramGiB).toBe(vramGiB);
      expect(gpu?.memoryType).toBe(memoryType);
      expect(gpu?.architecture).toBe(architecture);
      expect(gpu?.sharedMemoryGiB).toBeUndefined();
      expect(gpu?.provenance.sourceType).toBe("manufacturer-specification");
      expect(gpu?.provenance.confidence).toBe("verified");
      expect(gpu?.provenance.lastVerified).toBe("2026-09-29");
      expect(gpu?.provenance.sourceUrl).toMatch(/^https:\/\//);
    }

    expect(byId.get("nvidia-geforce-rtx-4070-12gb")?.provenance.note).toContain(
      "GDDR6 or 12 GB GDDR6X",
    );
    expect(
      byId.get("nvidia-geforce-rtx-3060-ti-8gb")?.provenance.note,
    ).toContain("8 GB GDDR6 and 8 GB GDDR6X");
  });

  it("records distinct laptop GPU variants with NVIDIA specifications and provenance", () => {
    const expected = [
      [
        "nvidia-geforce-rtx-3060-laptop-gpu-6gb",
        "rtx-3060-laptop-gpu-6gb",
        "GeForce RTX 3060 Laptop GPU 6GB",
        6,
        "Ampere",
        "https://www.nvidia.com/en-us/geforce/laptops/compare/30-series/",
      ],
      [
        "nvidia-geforce-rtx-4050-laptop-gpu-6gb",
        "rtx-4050-laptop-gpu-6gb",
        "GeForce RTX 4050 Laptop GPU 6GB",
        6,
        "Ada Lovelace",
        "https://www.nvidia.com/en-us/geforce/laptops/40-series/",
      ],
      [
        "nvidia-geforce-rtx-4060-laptop-gpu-8gb",
        "rtx-4060-laptop-gpu-8gb",
        "GeForce RTX 4060 Laptop GPU 8GB",
        8,
        "Ada Lovelace",
        "https://www.nvidia.com/en-us/geforce/laptops/40-series/",
      ],
      [
        "nvidia-geforce-rtx-4070-laptop-gpu-8gb",
        "rtx-4070-laptop-gpu-8gb",
        "GeForce RTX 4070 Laptop GPU 8GB",
        8,
        "Ada Lovelace",
        "https://www.nvidia.com/en-us/geforce/laptops/40-series/",
      ],
      [
        "nvidia-geforce-rtx-4080-laptop-gpu-12gb",
        "rtx-4080-laptop-gpu-12gb",
        "GeForce RTX 4080 Laptop GPU 12GB",
        12,
        "Ada Lovelace",
        "https://www.nvidia.com/en-us/geforce/laptops/40-series/",
      ],
      [
        "nvidia-geforce-rtx-4090-laptop-gpu-16gb",
        "rtx-4090-laptop-gpu-16gb",
        "GeForce RTX 4090 Laptop GPU 16GB",
        16,
        "Ada Lovelace",
        "https://www.nvidia.com/en-us/geforce/laptops/40-series/",
      ],
    ] as const;
    const byId = new Map(productionGpus.map((gpu) => [gpu.id, gpu]));

    for (const [
      id,
      slug,
      displayName,
      vramGiB,
      architecture,
      sourceUrl,
    ] of expected) {
      const gpu = byId.get(id);
      expect(gpu).toBeDefined();
      expect(gpu?.slug).toBe(slug);
      expect(gpu?.displayName).toBe(displayName);
      expect(gpu?.kind).toBe("discrete");
      expect(gpu?.vendor).toBe("NVIDIA");
      expect(gpu?.vramGiB).toBe(vramGiB);
      expect(gpu?.memoryType).toBe("GDDR6");
      expect(gpu?.architecture).toBe(architecture);
      expect(gpu?.sharedMemoryGiB).toBeUndefined();
      expect(gpu?.provenance.sourceType).toBe("manufacturer-specification");
      expect(gpu?.provenance.confidence).toBe("verified");
      expect(gpu?.provenance.sourceUrl).toBe(sourceUrl);
      expect(gpu?.provenance.lastVerified).toBe("2026-09-29");
      expect(gpu?.suitabilitySummary).toContain("power and cooling");
    }

    expect(
      productionGpus.filter((gpu) => gpu.id.includes("laptop-gpu")),
    ).toHaveLength(6);
    expect(byId.get("nvidia-rtx-3060-12gb")?.vramGiB).toBe(12);
    expect(byId.get("nvidia-rtx-4060-8gb")?.slug).toBe("rtx-4060-8gb");
    expect(byId.get("nvidia-geforce-rtx-4070-12gb")?.vramGiB).toBe(12);
    expect(byId.get("nvidia-rtx-4090-24gb")?.vramGiB).toBe(24);
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
      "qwen-qwen3-vl-8b-instruct": "excluded",
      "qwen-qwen3-vl-30b-a3b-instruct": "excluded",
      "mistralai-ministral-3-14b-instruct-2512": "excluded",
      "mistralai-devstral-small-2-24b-instruct-2512": "excluded",
      "mistralai-mistral-small-4-119b-2603": "unverified",
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
