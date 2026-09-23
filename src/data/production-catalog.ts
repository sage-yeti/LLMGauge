import type {
  CatalogProvenance,
  GpuDefinition,
  ModelDefinition,
  QuantizationDefinition,
} from "@/domain/types";

const verifiedOn = "2026-09-22";

const ggufQuantizationSource: CatalogProvenance = {
  source: "llama.cpp quantization documentation",
  sourceUrl:
    "https://github.com/ggml-org/llama.cpp/blob/master/tools/quantize/README.md",
  sourceType: "project-documentation",
  confidence: "approximate",
  lastVerified: verifiedOn,
  note: "Bits-per-weight values are planning estimates for common GGUF types; actual file sizes vary with model architecture and metadata.",
};

function ggufQuantizations(): QuantizationDefinition[] {
  return [
    {
      id: "q4-k-m",
      displayName: "Q4_K_M",
      bitsPerWeight: 4.5,
      description:
        "Common lower-memory GGUF choice; actual files are produced by community or vendor conversion pipelines.",
      provenance: ggufQuantizationSource,
    },
    {
      id: "q5-k-m",
      displayName: "Q5_K_M",
      bitsPerWeight: 5.5,
      description:
        "Middle-ground GGUF choice with a larger memory requirement than Q4_K_M.",
      provenance: ggufQuantizationSource,
    },
    {
      id: "q8-0",
      displayName: "Q8_0",
      bitsPerWeight: 8,
      description:
        "Higher-memory GGUF choice; it is still an approximate memory-planning input rather than a performance claim.",
      provenance: ggufQuantizationSource,
    },
  ];
}

function modelProvenance(
  source: string,
  sourceUrl: string,
  note: string,
  lastVerified = verifiedOn,
): CatalogProvenance {
  return {
    source,
    sourceUrl,
    sourceType: "official-model-card",
    confidence: "verified",
    lastVerified,
    note,
  };
}

function model(
  definition: Omit<ModelDefinition, "quantizations"> & {
    quantizations?: QuantizationDefinition[];
  },
): ModelDefinition {
  return {
    ...definition,
    quantizations: definition.quantizations ?? ggufQuantizations(),
  };
}

export const productionModels: readonly ModelDefinition[] = [
  model({
    id: "meta-llama-3-2-1b-instruct",
    slug: "llama-3-2-1b-instruct",
    displayName: "Llama 3.2 1B Instruct",
    summary:
      "Meta's compact instruction-tuned Llama model for lightweight local text generation.",
    family: "Llama 3.2",
    provider: "Meta",
    architecture: "Llama",
    parameterCountBillions: 1,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "Llama 3.2 Community License",
    defaultContextLength: 4096,
    maxContextLength: 131072,
    provenance: modelProvenance(
      "Meta Llama 3.2 model card",
      "https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct",
      "Parameter and context metadata come from the publisher's model card. GGUF quantization candidates are tracked separately and may be community-converted.",
    ),
  }),
  model({
    id: "meta-llama-3-2-3b-instruct",
    slug: "llama-3-2-3b-instruct",
    displayName: "Llama 3.2 3B Instruct",
    summary:
      "Meta's 3B instruction-tuned Llama model, suitable for modest local hardware when quantized.",
    family: "Llama 3.2",
    provider: "Meta",
    architecture: "Llama",
    parameterCountBillions: 3,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "Llama 3.2 Community License",
    defaultContextLength: 4096,
    maxContextLength: 131072,
    provenance: modelProvenance(
      "Meta Llama 3.2 model card",
      "https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct",
      "Publisher metadata is separated from approximate GGUF memory-planning candidates.",
    ),
  }),
  model({
    id: "google-gemma-3-1b-it",
    slug: "gemma-3-1b-it",
    displayName: "Gemma 3 1B IT",
    summary:
      "Google's compact instruction-tuned Gemma 3 text model for constrained local systems.",
    family: "Gemma 3",
    provider: "Google",
    architecture: "Gemma",
    parameterCountBillions: 1,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "Gemma Terms of Use",
    defaultContextLength: 4096,
    maxContextLength: 32768,
    provenance: modelProvenance(
      "Google Gemma 3 model card",
      "https://huggingface.co/google/gemma-3-1b-it",
      "The publisher specifies 32K input context for the 1B variant; the 128K figure applies to larger Gemma 3 variants. Runtime and conversion support may impose lower practical limits.",
      "2026-09-23",
    ),
  }),
  model({
    id: "google-gemma-3-4b-it",
    slug: "gemma-3-4b-it",
    displayName: "Gemma 3 4B IT",
    summary:
      "Google's 4B instruction-tuned Gemma 3 model with text and image-input capabilities in its published model family.",
    family: "Gemma 3",
    provider: "Google",
    architecture: "Gemma",
    parameterCountBillions: 4,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "Gemma Terms of Use",
    defaultContextLength: 4096,
    maxContextLength: 131072,
    provenance: modelProvenance(
      "Google Gemma 3 model card",
      "https://huggingface.co/google/gemma-3-4b-it",
      "The calculator models text-generation memory only; it does not estimate image-encoder memory or multimodal runtime behavior.",
    ),
  }),
  model({
    id: "qwen-2-5-3b-instruct",
    slug: "qwen-2-5-3b-instruct",
    displayName: "Qwen2.5 3B Instruct",
    summary:
      "Qwen's 3B instruction-tuned model with a published 32K context configuration for its GGUF variant.",
    family: "Qwen2.5",
    provider: "Qwen",
    architecture: "Qwen",
    parameterCountBillions: 3,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "Apache-2.0",
    defaultContextLength: 4096,
    maxContextLength: 32768,
    provenance: modelProvenance(
      "Qwen2.5 3B Instruct GGUF model card",
      "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF",
      "The page documents the GGUF variant's 32K context and common quantization names; memory estimates remain approximate.",
    ),
  }),
  model({
    id: "qwen-2-5-7b-instruct",
    slug: "qwen-2-5-7b-instruct",
    displayName: "Qwen2.5 7B Instruct",
    summary:
      "Qwen's 7B instruction-tuned model for users with more memory and a need for a broader general-purpose model.",
    family: "Qwen2.5",
    provider: "Qwen",
    architecture: "Qwen",
    parameterCountBillions: 7,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "Apache-2.0",
    defaultContextLength: 4096,
    maxContextLength: 32768,
    provenance: modelProvenance(
      "Qwen2.5 7B Instruct GGUF model card",
      "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF",
      "The GGUF publisher page documents a 32K context configuration; the base model advertises a longer context that is not assumed here.",
    ),
  }),
  model({
    id: "microsoft-phi-3-5-mini-instruct",
    slug: "phi-3-5-mini-instruct",
    displayName: "Phi-3.5 Mini Instruct",
    summary:
      "Microsoft's compact Phi instruction model with a documented long-context capability.",
    family: "Phi-3.5",
    provider: "Microsoft",
    architecture: "Phi",
    parameterCountBillions: 3.8,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "MIT",
    defaultContextLength: 4096,
    maxContextLength: 131072,
    provenance: modelProvenance(
      "Microsoft Phi-3.5 Mini model card",
      "https://huggingface.co/microsoft/Phi-3.5-mini-instruct",
      "The model card documents 128K context support; practical memory requirements depend strongly on the selected context and runtime.",
    ),
  }),
  model({
    id: "mistralai-mistral-7b-instruct-v0-3",
    slug: "mistral-7b-instruct-v0-3",
    displayName: "Mistral 7B Instruct v0.3",
    summary:
      "Mistral's 7B instruction-tuned model with a broad ecosystem of local GGUF conversions.",
    family: "Mistral",
    provider: "Mistral AI",
    architecture: "Mistral",
    parameterCountBillions: 7,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "Apache-2.0",
    defaultContextLength: 4096,
    maxContextLength: 32768,
    provenance: modelProvenance(
      "Mistral 7B Instruct v0.3 model card",
      "https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.3",
      "The public model card identifies the instruct variant; this catalog uses a conservative 32K maximum for local GGUF planning.",
    ),
  }),
];

function gpuProvenance(source: string, sourceUrl: string): CatalogProvenance {
  return {
    source,
    sourceUrl,
    sourceType: "manufacturer-specification",
    confidence: "verified",
    lastVerified: verifiedOn,
    note: "VRAM is the manufacturer's standard memory configuration; local runtime suitability is a conservative LLMGauge interpretation, not a benchmark.",
  };
}

export const productionGpus: readonly GpuDefinition[] = [
  {
    id: "nvidia-rtx-3060-12gb",
    slug: "rtx-3060-12gb",
    displayName: "GeForce RTX 3060 12GB",
    kind: "discrete",
    vendor: "NVIDIA",
    architecture: "Ampere",
    vramGiB: 12,
    suitabilitySummary:
      "A 12 GiB discrete GPU that leaves room for many small and medium quantized models, subject to system RAM and context requirements.",
    provenance: gpuProvenance(
      "NVIDIA GeForce RTX 3060 specifications",
      "https://www.nvidia.com/en-us/geforce/graphics-cards/30-series/rtx-3060-3060ti/",
    ),
  },
  {
    id: "nvidia-rtx-4060-8gb",
    slug: "rtx-4060-8gb",
    displayName: "GeForce RTX 4060 8GB",
    kind: "discrete",
    vendor: "NVIDIA",
    architecture: "Ada Lovelace",
    vramGiB: 8,
    suitabilitySummary:
      "An 8 GiB discrete GPU for smaller and medium quantized models; larger models may require partial offload or CPU execution.",
    provenance: gpuProvenance(
      "NVIDIA GeForce RTX 4060 specifications",
      "https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4060-4060ti/",
    ),
  },
  {
    id: "nvidia-rtx-4070-super-12gb",
    slug: "rtx-4070-super-12gb",
    displayName: "GeForce RTX 4070 SUPER 12GB",
    kind: "discrete",
    vendor: "NVIDIA",
    architecture: "Ada Lovelace",
    vramGiB: 12,
    suitabilitySummary:
      "A 12 GiB discrete GPU with the same capacity class as other 12 GiB cards; the calculator intentionally does not infer speed from the GPU name.",
    provenance: gpuProvenance(
      "NVIDIA GeForce RTX 4070 family specifications",
      "https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4070-family/",
    ),
  },
  {
    id: "nvidia-rtx-4090-24gb",
    slug: "rtx-4090-24gb",
    displayName: "GeForce RTX 4090 24GB",
    kind: "discrete",
    vendor: "NVIDIA",
    architecture: "Ada Lovelace",
    vramGiB: 24,
    suitabilitySummary:
      "A 24 GiB discrete GPU with substantial capacity for larger quantized models, without implying a particular speed or context guarantee.",
    provenance: gpuProvenance(
      "NVIDIA GeForce RTX 4090 specifications",
      "https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4090/",
    ),
  },
  {
    id: "amd-radeon-rx-7600-8gb",
    slug: "radeon-rx-7600-8gb",
    displayName: "Radeon RX 7600 8GB",
    kind: "discrete",
    vendor: "AMD",
    architecture: "RDNA 3",
    vramGiB: 8,
    suitabilitySummary:
      "An 8 GiB discrete GPU; actual llama.cpp backend support and practical results depend on the selected runtime and driver stack.",
    provenance: gpuProvenance(
      "AMD Radeon RX 7600 specifications",
      "https://www.amd.com/en/products/graphics/desktops/radeon/7000-series/amd-radeon-rx-7600.html",
    ),
  },
  {
    id: "amd-radeon-rx-7800-xt-16gb",
    slug: "radeon-rx-7800-xt-16gb",
    displayName: "Radeon RX 7800 XT 16GB",
    kind: "discrete",
    vendor: "AMD",
    architecture: "RDNA 3",
    vramGiB: 16,
    suitabilitySummary:
      "A 16 GiB discrete GPU with capacity for a wider range of quantized models; compatibility still depends on runtime support and system memory.",
    provenance: gpuProvenance(
      "AMD Radeon RX 7800 XT specifications",
      "https://www.amd.com/en/products/graphics/desktops/radeon/7000-series/amd-radeon-rx-7800-xt.html",
    ),
  },
  {
    id: "amd-radeon-rx-7900-xtx-24gb",
    slug: "radeon-rx-7900-xtx-24gb",
    displayName: "Radeon RX 7900 XTX 24GB",
    kind: "discrete",
    vendor: "AMD",
    architecture: "RDNA 3",
    vramGiB: 24,
    suitabilitySummary:
      "A 24 GiB discrete GPU with high memory capacity; no backend performance or universal compatibility claim is made.",
    provenance: gpuProvenance(
      "AMD Radeon RX 7900 XTX specifications",
      "https://www.amd.com/en/products/graphics/desktops/radeon/7000-series/amd-radeon-rx-7900xtx.html",
    ),
  },
  {
    id: "intel-arc-a750-8gb",
    slug: "arc-a750-8gb",
    displayName: "Intel Arc A750 8GB",
    kind: "discrete",
    vendor: "Intel",
    architecture: "Alchemist",
    vramGiB: 8,
    suitabilitySummary:
      "An 8 GiB discrete GPU; backend and driver support should be checked for the chosen llama.cpp build.",
    provenance: gpuProvenance(
      "Intel Arc A750 specifications",
      "https://www.intel.com/content/www/us/en/products/sku/227954/intel-arc-a750-graphics/specifications.html",
    ),
  },
  {
    id: "intel-arc-a770-16gb",
    slug: "arc-a770-16gb",
    displayName: "Intel Arc A770 16GB",
    kind: "discrete",
    vendor: "Intel",
    architecture: "Alchemist",
    vramGiB: 16,
    suitabilitySummary:
      "A 16 GiB discrete GPU; local LLM results depend on the llama.cpp backend, driver, and offload configuration.",
    provenance: gpuProvenance(
      "Intel Arc A770 16GB specifications",
      "https://www.intel.com/content/www/us/en/products/sku/229151/intel-arc-a770-graphics-16gb/specifications.html",
    ),
  },
  {
    id: "intel-uhd-graphics-770",
    slug: "intel-uhd-graphics-770",
    displayName: "Intel UHD Graphics 770",
    kind: "integrated",
    vendor: "Intel",
    architecture: "Xe integrated graphics",
    vramGiB: 0,
    suitabilitySummary:
      "Integrated graphics with no dedicated VRAM entry; LLMGauge conservatively treats shared system memory as CPU-only capacity.",
    provenance: gpuProvenance(
      "Intel processor graphics documentation",
      "https://www.intel.com/content/www/us/en/products/platforms/details/alder-lake-s.html",
    ),
  },
];
