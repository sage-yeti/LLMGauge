import type {
  CatalogProvenance,
  GpuDefinition,
  ModelDefinition,
  QuantizationDefinition,
} from "@/domain/types";

const verifiedOn = "2026-09-23";

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

function convertedQuantizations(
  repository: string,
  includeQ8 = true,
  lastVerified = verifiedOn,
): QuantizationDefinition[] {
  const sourceUrl = `https://huggingface.co/${repository}`;
  const provenance: CatalogProvenance = {
    source: `${repository} GGUF repository`,
    sourceUrl,
    sourceType: "community-conversion",
    confidence: "approximate",
    lastVerified,
    note: "The repository confirms available GGUF quantization files. Estimated weight size uses parameter count × bits-per-weight; it is not the downloaded file size and excludes runtime/context memory.",
  };
  const candidates: QuantizationDefinition[] = [
    {
      id: "q4-k-m",
      displayName: "Q4_K_M",
      bitsPerWeight: 4.5,
      description:
        "A commonly available lower-memory GGUF variant; the listed memory input is an estimate, not the repository file size.",
      provenance,
    },
  ];
  if (includeQ8) {
    candidates.push({
      id: "q8-0",
      displayName: "Q8_0",
      bitsPerWeight: 8,
      description:
        "A higher-memory GGUF variant where listed by the conversion repository; the listed memory input remains approximate.",
      provenance,
    });
  }
  return candidates;
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
  model({
    id: "qwen-qwen3-4b",
    slug: "qwen3-4b",
    displayName: "Qwen3 4B",
    summary:
      "Qwen's compact 4B general-purpose model; a separate GGUF conversion is listed for llama.cpp workflows.",
    family: "Qwen3",
    provider: "Qwen",
    architecture: "Qwen3",
    parameterCountBillions: 4,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "Apache-2.0",
    maxContextLength: 32768,
    provenance: modelProvenance(
      "Qwen3 4B publisher model card",
      "https://huggingface.co/Qwen/Qwen3-4B",
      "Publisher model metadata and license; the separate Qwen GGUF repository is community conversion data. The catalog uses the documented native 32K context and does not assume extended-context settings.",
    ),
    quantizations: convertedQuantizations("Qwen/Qwen3-4B-GGUF"),
  }),
  model({
    id: "qwen-qwen3-8b",
    slug: "qwen3-8b",
    displayName: "Qwen3 8B",
    summary:
      "An 8B Qwen3 general-purpose model that adds a mid-sized option beyond the existing Qwen2.5 entries.",
    family: "Qwen3",
    provider: "Qwen",
    architecture: "Qwen3",
    parameterCountBillions: 8,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "Apache-2.0",
    maxContextLength: 32768,
    provenance: modelProvenance(
      "Qwen3 8B publisher model card",
      "https://huggingface.co/Qwen/Qwen3-8B",
      "Publisher model metadata and license. GGUF candidates come from a separate Qwen conversion repository; extended YaRN context is not represented as the default maximum here.",
    ),
    quantizations: convertedQuantizations("ggml-org/Qwen3-8B-GGUF"),
  }),
  model({
    id: "qwen-qwen2-5-coder-7b-instruct",
    slug: "qwen2-5-coder-7b-instruct",
    displayName: "Qwen2.5-Coder 7B Instruct",
    summary:
      "A code-focused instruction model, adding a distinct software-development use case to the catalog.",
    family: "Qwen2.5-Coder",
    provider: "Qwen",
    architecture: "Qwen2",
    parameterCountBillions: 7.6,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "Apache-2.0",
    maxContextLength: 131072,
    provenance: modelProvenance(
      "Qwen2.5-Coder 7B Instruct publisher model card",
      "https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct",
      "The publisher describes this as the 7B code-specialized variant. Parameter count is rounded to 7.6B for planning; Qwen separately publishes GGUF conversion files.",
    ),
    quantizations: convertedQuantizations(
      "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF",
    ),
  }),
  model({
    id: "meta-llama-3-1-8b-instruct",
    slug: "llama-3-1-8b-instruct",
    displayName: "Llama 3.1 8B Instruct",
    summary:
      "Meta's 8B instruction-tuned Llama 3.1 model with publisher-documented long-context metadata.",
    family: "Llama 3.1",
    provider: "Meta",
    architecture: "Llama",
    parameterCountBillions: 8,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "Llama 3.1 Community License",
    maxContextLength: 131072,
    provenance: modelProvenance(
      "Meta Llama 3.1 8B Instruct model card",
      "https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct",
      "Publisher card reports 8B parameters and 128K context. GGUF conversion is community-provided and remains subject to the model's community license.",
    ),
    quantizations: convertedQuantizations(
      "mradermacher/Meta-Llama-3.1-8B-GGUF",
    ),
  }),
  model({
    id: "google-gemma-3-12b-it",
    slug: "gemma-3-12b-it",
    displayName: "Gemma 3 12B IT",
    summary:
      "The 12B Gemma 3 instruction model adds a larger text-and-image family option; this estimate covers text weights only.",
    family: "Gemma 3",
    provider: "Google",
    architecture: "Gemma",
    parameterCountBillions: 12,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "Gemma Terms of Use",
    maxContextLength: 131072,
    provenance: modelProvenance(
      "Google Gemma 3 12B IT model card",
      "https://huggingface.co/google/gemma-3-12b-it",
      "Publisher metadata; image encoder, image tokens, and multimodal runtime memory are not modeled. The ggml-org repository provides a separate GGUF conversion.",
    ),
    quantizations: convertedQuantizations(
      "ggml-org/gemma-3-12b-it-GGUF",
      false,
    ),
  }),
  model({
    id: "google-gemma-3-27b-it",
    slug: "gemma-3-27b-it",
    displayName: "Gemma 3 27B IT",
    summary:
      "Google's largest Gemma 3 instruction variant, useful for exploring high-memory local configurations.",
    family: "Gemma 3",
    provider: "Google",
    architecture: "Gemma",
    parameterCountBillions: 27,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "Gemma Terms of Use",
    maxContextLength: 131072,
    provenance: modelProvenance(
      "Google Gemma 3 27B IT model card",
      "https://huggingface.co/google/gemma-3-27b-it",
      "Publisher metadata; multimodal encoder memory is outside the text-weight estimate. GGUF availability is documented separately by ggml-org.",
    ),
    quantizations: convertedQuantizations("ggml-org/gemma-3-27b-it-GGUF"),
  }),
  model({
    id: "microsoft-phi-4-mini-instruct",
    slug: "phi-4-mini-instruct",
    displayName: "Phi-4 Mini Instruct",
    summary:
      "Microsoft's 3.8B instruction model provides a compact alternative with a publisher-documented 128K context limit.",
    family: "Phi-4",
    provider: "Microsoft",
    architecture: "Phi",
    parameterCountBillions: 3.8,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "MIT",
    maxContextLength: 131072,
    provenance: modelProvenance(
      "Microsoft Phi-4 Mini Instruct model card",
      "https://huggingface.co/microsoft/Phi-4-mini-instruct",
      "Microsoft reports 3.8B parameters, 128K context, and MIT licensing. GGUF is a community conversion; runtime-specific context memory is not estimated.",
    ),
    quantizations: convertedQuantizations(
      "second-state/Phi-4-mini-instruct-GGUF",
    ),
  }),
  model({
    id: "mistralai-mistral-nemo-12b-instruct-2407",
    slug: "mistral-nemo-12b-instruct-2407",
    displayName: "Mistral Nemo 12B Instruct",
    summary:
      "A 12B Mistral and NVIDIA collaboration model, extending the catalog into a larger multilingual instruction tier.",
    family: "Mistral Nemo",
    provider: "Mistral AI / NVIDIA",
    architecture: "Mistral",
    parameterCountBillions: 12,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "Apache-2.0",
    maxContextLength: 131072,
    provenance: modelProvenance(
      "Mistral Nemo Instruct 2407 model card",
      "https://huggingface.co/mistralai/Mistral-Nemo-Instruct-2407",
      "Publisher model card identifies the 12B model and Apache-2.0 license. Quantization files are a community conversion and the 128K limit is not a hardware-fit claim.",
    ),
    quantizations: convertedQuantizations(
      "QuantFactory/Mistral-Nemo-Instruct-2407-GGUF",
    ),
  }),
  model({
    id: "qwen-qwen3-14b",
    slug: "qwen3-14b",
    displayName: "Qwen3 14B",
    summary:
      "Qwen's 14.8B general-purpose Qwen3 model, filling the size range between the existing 8B and 27B entries.",
    family: "Qwen3",
    provider: "Qwen",
    architecture: "Qwen3",
    parameterCountBillions: 14.8,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "Apache-2.0",
    maxContextLength: 32768,
    provenance: modelProvenance(
      "Qwen3 14B publisher model card",
      "https://huggingface.co/Qwen/Qwen3-14B",
      "Parameter count, Apache-2.0 license, and native 32K context come from the publisher. The separate GGUF candidates are from bartowski's community conversion; extended YaRN context is not included.",
      "2026-09-24",
    ),
    quantizations: convertedQuantizations(
      "bartowski/Qwen_Qwen3-14B-GGUF",
      true,
      "2026-09-24",
    ),
  }),
  model({
    id: "qwen-qwen3-32b",
    slug: "qwen3-32b",
    displayName: "Qwen3 32B",
    summary:
      "Qwen's 32.8B general-purpose Qwen3 model for users evaluating the larger end of the local model range.",
    family: "Qwen3",
    provider: "Qwen",
    architecture: "Qwen3",
    parameterCountBillions: 32.8,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "Apache-2.0",
    maxContextLength: 32768,
    provenance: modelProvenance(
      "Qwen3 32B publisher model card",
      "https://huggingface.co/Qwen/Qwen3-32B",
      "Parameter count, Apache-2.0 license, and native 32K context come from the publisher. The separate GGUF candidates are from bartowski's community conversion; extended YaRN context is not included.",
      "2026-09-24",
    ),
    quantizations: convertedQuantizations(
      "bartowski/Qwen_Qwen3-32B-GGUF",
      true,
      "2026-09-24",
    ),
  }),
  model({
    id: "mistralai-mistral-small-3-2-24b-instruct-2506",
    slug: "mistral-small-3-2-24b-instruct-2506",
    displayName: "Mistral Small 3.2 24B Instruct",
    summary:
      "Mistral's 24B instruction-tuned model; the memory estimate covers text weights and not its image-processing path.",
    family: "Mistral Small 3.2",
    provider: "Mistral AI",
    architecture: "Mistral",
    parameterCountBillions: 24,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "Apache-2.0",
    maxContextLength: 131072,
    provenance: modelProvenance(
      "Mistral Small 3.2 model documentation",
      "https://docs.mistral.ai/models/mistral-small-3-2-25-06",
      "Mistral's documentation lists a 128K context and Apache-2.0 license and marks Small 3.2 deprecated for new integrations; the publisher model card identifies the 24B instruct variant. This entry is for local GGUF memory planning, not an API recommendation. Image-processing memory is outside this text-weight estimate. The listed GGUF candidates are a separate bartowski community conversion.",
      "2026-09-24",
    ),
    quantizations: convertedQuantizations(
      "bartowski/mistralai_Mistral-Small-3.2-24B-Instruct-2506-GGUF",
      true,
      "2026-09-24",
    ),
  }),
  model({
    id: "meta-llama-3-3-70b-instruct",
    slug: "llama-3-3-70b-instruct",
    displayName: "Llama 3.3 70B Instruct",
    summary:
      "Meta's 70B text-only instruction model, extending the catalog into the high-memory class.",
    family: "Llama 3.3",
    provider: "Meta",
    architecture: "Llama",
    parameterCountBillions: 70,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "Llama 3.3 Community License",
    maxContextLength: 131072,
    provenance: modelProvenance(
      "Meta Llama 3.3 70B Instruct model card",
      "https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct",
      "Meta documents the text-only 70B variant, 128K context, and Llama 3.3 Community License. The GGUF candidates are from bartowski's separate community conversion and remain subject to the model's license.",
      "2026-09-24",
    ),
    quantizations: convertedQuantizations(
      "bartowski/Llama-3.3-70B-Instruct-GGUF",
      true,
      "2026-09-24",
    ),
  }),
  model({
    id: "deepseek-r1-distill-qwen-1-5b",
    slug: "deepseek-r1-distill-qwen-1-5b",
    displayName: "DeepSeek-R1-Distill-Qwen 1.5B",
    summary:
      "DeepSeek's compact reasoning-focused model distilled from Qwen2.5, adding a smaller option for local reasoning experiments.",
    family: "DeepSeek-R1 Distill",
    provider: "DeepSeek",
    architecture: "Qwen2",
    parameterCountBillions: 1.5,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "MIT",
    maxContextLength: 131072,
    provenance: modelProvenance(
      "DeepSeek-R1-Distill-Qwen 1.5B model card",
      "https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
      "The publisher lists this distilled model under MIT and its config allows up to 131,072 tokens; its model card also notes the Qwen2.5 base-model license. GGUF candidates are tracked separately as a community conversion; runtime and long-context memory requirements are not verified.",
      "2026-09-25",
    ),
    quantizations: convertedQuantizations(
      "bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF",
      true,
      "2026-09-25",
    ),
  }),
  model({
    id: "qwen-qwen3-5-2b",
    slug: "qwen3-5-2b",
    displayName: "Qwen3.5 2B",
    summary:
      "Qwen's compact multimodal model for text and image input; this estimate covers text weights and not vision processing.",
    family: "Qwen3.5",
    provider: "Qwen",
    architecture: "Qwen3.5",
    parameterCountBillions: 2,
    supportedFormats: ["gguf", "safetensors"],
    supportedRuntimes: ["llama.cpp"],
    license: "Apache-2.0",
    maxContextLength: 262144,
    provenance: modelProvenance(
      "Qwen3.5 2B publisher model card",
      "https://huggingface.co/Qwen/Qwen3.5-2B",
      "Publisher model card lists Apache-2.0 licensing and native 262,144-token context. The parameter count follows the publisher's 2B variant name. GGUF candidates are a separate community conversion; vision-encoder and image-input memory are outside this text-weight estimate.",
      "2026-09-25",
    ),
    quantizations: convertedQuantizations(
      "unsloth/Qwen3.5-2B-GGUF",
      true,
      "2026-09-25",
    ),
  }),
];

function gpuProvenance(
  source: string,
  sourceUrl: string,
  lastVerified = verifiedOn,
): CatalogProvenance {
  return {
    source,
    sourceUrl,
    sourceType: "manufacturer-specification",
    confidence: "verified",
    lastVerified,
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
  {
    id: "nvidia-rtx-2060-6gb",
    slug: "rtx-2060-6gb",
    displayName: "GeForce RTX 2060 6GB",
    kind: "discrete",
    vendor: "NVIDIA",
    architecture: "Turing",
    vramGiB: 6,
    memoryType: "GDDR6",
    suitabilitySummary:
      "An older 6 GiB discrete card; useful for evaluating smaller quantized models, with limited dedicated-memory headroom.",
    provenance: gpuProvenance(
      "NVIDIA GeForce RTX 2060 specification announcement",
      "https://nvidianews.nvidia.com/news/nvidia-geforce-rtx-2060-is-here-next-gen-gaming-takes-off",
    ),
  },
  {
    id: "nvidia-rtx-4060-ti-16gb",
    slug: "rtx-4060-ti-16gb",
    displayName: "GeForce RTX 4060 Ti 16GB",
    kind: "discrete",
    vendor: "NVIDIA",
    architecture: "Ada Lovelace",
    vramGiB: 16,
    memoryType: "GDDR6",
    suitabilitySummary:
      "The 16 GiB RTX 4060 Ti variant offers more model-memory capacity than the 8 GiB version; the catalog treats capacity separately from speed.",
    provenance: gpuProvenance(
      "NVIDIA GeForce RTX 4060 Ti specifications",
      "https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4060-4060ti/",
    ),
  },
  {
    id: "nvidia-rtx-4070-ti-super-16gb",
    slug: "rtx-4070-ti-super-16gb",
    displayName: "GeForce RTX 4070 Ti SUPER 16GB",
    kind: "discrete",
    vendor: "NVIDIA",
    architecture: "Ada Lovelace",
    vramGiB: 16,
    memoryType: "GDDR6X",
    suitabilitySummary:
      "A 16 GiB discrete GPU that broadens the catalog's mid/high capacity range without implying model speed or guaranteed fit.",
    provenance: gpuProvenance(
      "NVIDIA GeForce RTX 4070 family specifications",
      "https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4070-family/",
    ),
  },
  {
    id: "nvidia-rtx-5080-16gb",
    slug: "rtx-5080-16gb",
    displayName: "GeForce RTX 5080 16GB",
    kind: "discrete",
    vendor: "NVIDIA",
    architecture: "Blackwell",
    vramGiB: 16,
    memoryType: "GDDR7",
    suitabilitySummary:
      "A current 16 GiB discrete option; compatibility uses memory capacity only and does not infer backend availability or performance.",
    provenance: gpuProvenance(
      "NVIDIA GeForce RTX 5080 specifications",
      "https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5080/",
    ),
  },
  {
    id: "amd-radeon-rx-6600-8gb",
    slug: "radeon-rx-6600-8gb",
    displayName: "Radeon RX 6600 8GB",
    kind: "discrete",
    vendor: "AMD",
    architecture: "RDNA 2",
    vramGiB: 8,
    memoryType: "GDDR6",
    suitabilitySummary:
      "An established 8 GiB discrete GPU; actual llama.cpp backend and driver support depend on the user's software stack.",
    provenance: gpuProvenance(
      "AMD Radeon RX 6600 specifications",
      "https://www.amd.com/en/products/graphics/desktops/radeon/6000-series/amd-radeon-rx-6600.html",
    ),
  },
  {
    id: "amd-radeon-rx-7700-xt-12gb",
    slug: "radeon-rx-7700-xt-12gb",
    displayName: "Radeon RX 7700 XT 12GB",
    kind: "discrete",
    vendor: "AMD",
    architecture: "RDNA 3",
    vramGiB: 12,
    memoryType: "GDDR6",
    suitabilitySummary:
      "A 12 GiB RDNA 3 card that fills the catalog's AMD mid-capacity range; memory fit does not confirm backend support.",
    provenance: gpuProvenance(
      "AMD Radeon RX 7700 XT product specifications",
      "https://www.amd.com/en/newsroom/press-releases/2023-8-25-new-amd-radeon-rx-7800-xt-and-radeon-rx-7700-xt-gr.html",
    ),
  },
  {
    id: "amd-radeon-rx-9070-16gb",
    slug: "radeon-rx-9070-16gb",
    displayName: "Radeon RX 9070 16GB",
    kind: "discrete",
    vendor: "AMD",
    architecture: "RDNA 4",
    vramGiB: 16,
    memoryType: "GDDR6",
    suitabilitySummary:
      "A newer 16 GiB discrete option; LLMGauge reports its memory class while leaving runtime and driver compatibility to the user's setup.",
    provenance: gpuProvenance(
      "AMD Radeon RX 9070 specifications",
      "https://www.amd.com/en/products/graphics/desktops/radeon/9000-series/amd-radeon-rx-9070.html",
    ),
  },
  {
    id: "amd-radeon-rx-9070-xt-16gb",
    slug: "radeon-rx-9070-xt-16gb",
    displayName: "Radeon RX 9070 XT 16GB",
    kind: "discrete",
    vendor: "AMD",
    architecture: "RDNA 4",
    vramGiB: 16,
    memoryType: "GDDR6",
    suitabilitySummary:
      "The RX 9070 XT provides a current 16 GiB AMD option; no speed or universal llama.cpp support is inferred.",
    provenance: gpuProvenance(
      "AMD Radeon RX 9070 XT specifications",
      "https://www.amd.com/en/products/graphics/desktops/radeon/9000-series/amd-radeon-rx-9070xt.html",
    ),
  },
  {
    id: "intel-arc-b570-10gb",
    slug: "arc-b570-10gb",
    displayName: "Intel Arc B570 10GB",
    kind: "discrete",
    vendor: "Intel",
    architecture: "Battlemage",
    vramGiB: 10,
    memoryType: "GDDR6",
    suitabilitySummary:
      "A 10 GiB Intel discrete GPU; check the selected llama.cpp build and driver for backend support before relying on offload.",
    provenance: gpuProvenance(
      "Intel Arc B570 specifications",
      "https://www.intel.com/content/www/us/en/products/sku/241676/intel-arc-b570-graphics/specifications.html",
    ),
  },
  {
    id: "intel-arc-b580-12gb",
    slug: "arc-b580-12gb",
    displayName: "Intel Arc B580 12GB",
    kind: "discrete",
    vendor: "Intel",
    architecture: "Battlemage",
    vramGiB: 12,
    memoryType: "GDDR6",
    suitabilitySummary:
      "A 12 GiB Intel discrete GPU that expands the memory-capacity range; available runtime paths remain software-dependent.",
    provenance: gpuProvenance(
      "Intel Arc B580 specifications",
      "https://www.intel.com/content/www/us/en/products/sku/241598/intel-arc-b580-graphics/specifications.html",
    ),
  },
  {
    id: "amd-radeon-780m-integrated",
    slug: "radeon-780m-integrated",
    displayName: "AMD Radeon 780M integrated graphics",
    kind: "integrated",
    vendor: "AMD",
    architecture: "RDNA 3",
    vramGiB: 0,
    suitabilitySummary:
      "Integrated graphics use system memory rather than a fixed dedicated VRAM capacity; LLMGauge conservatively classifies this as CPU-only capacity.",
    provenance: {
      source: "AMD Ryzen 7 7840U specifications",
      sourceUrl:
        "https://www.amd.com/en/products/processors/laptop/ryzen/7000-series/amd-ryzen-7-7840u.html",
      sourceType: "manufacturer-specification",
      confidence: "verified",
      lastVerified: verifiedOn,
      note: "The processor specification identifies Radeon 780M integrated graphics. No fixed shared-memory allocation is asserted because it is system-configured.",
    },
  },
  {
    id: "nvidia-rtx-5060-ti-16gb",
    slug: "rtx-5060-ti-16gb",
    displayName: "GeForce RTX 5060 Ti 16GB",
    kind: "discrete",
    vendor: "NVIDIA",
    architecture: "Blackwell",
    vramGiB: 16,
    memoryType: "GDDR7",
    suitabilitySummary:
      "The 16 GiB RTX 5060 Ti configuration adds a current midrange capacity option; memory capacity does not imply model speed or guaranteed fit.",
    provenance: gpuProvenance(
      "NVIDIA GeForce RTX 5060 family specifications",
      "https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5060-family/",
      "2026-09-24",
    ),
  },
  {
    id: "nvidia-rtx-5070-12gb",
    slug: "rtx-5070-12gb",
    displayName: "GeForce RTX 5070 12GB",
    kind: "discrete",
    vendor: "NVIDIA",
    architecture: "Blackwell",
    vramGiB: 12,
    memoryType: "GDDR7",
    suitabilitySummary:
      "A 12 GiB Blackwell configuration that adds the non-Ti RTX 5070 capacity class without implying runtime performance.",
    provenance: gpuProvenance(
      "NVIDIA GeForce RTX 5070 family specifications",
      "https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5070-family/",
      "2026-09-24",
    ),
  },
  {
    id: "nvidia-rtx-5070-ti-16gb",
    slug: "rtx-5070-ti-16gb",
    displayName: "GeForce RTX 5070 Ti 16GB",
    kind: "discrete",
    vendor: "NVIDIA",
    architecture: "Blackwell",
    vramGiB: 16,
    memoryType: "GDDR7",
    suitabilitySummary:
      "A 16 GiB Blackwell configuration that fills the RTX 5070 Ti tier between the catalog's RTX 5080 and lower-capacity cards.",
    provenance: gpuProvenance(
      "NVIDIA GeForce RTX 5070 family specifications",
      "https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5070-family/",
      "2026-09-24",
    ),
  },
  {
    id: "nvidia-rtx-5090-32gb",
    slug: "rtx-5090-32gb",
    displayName: "GeForce RTX 5090 32GB",
    kind: "discrete",
    vendor: "NVIDIA",
    architecture: "Blackwell",
    vramGiB: 32,
    memoryType: "GDDR7",
    suitabilitySummary:
      "The 32 GiB RTX 5090 adds the catalog's largest documented discrete-memory class; it does not guarantee a model or context will fit.",
    provenance: gpuProvenance(
      "NVIDIA GeForce RTX 5090 specifications",
      "https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/",
      "2026-09-24",
    ),
  },
  {
    id: "amd-radeon-rx-9060-xt-16gb",
    slug: "radeon-rx-9060-xt-16gb",
    displayName: "Radeon RX 9060 XT 16GB",
    kind: "discrete",
    vendor: "AMD",
    architecture: "RDNA 4",
    vramGiB: 16,
    memoryType: "GDDR6",
    suitabilitySummary:
      "AMD's 16 GiB RX 9060 XT adds a more accessible RDNA 4 memory tier; selected-backend and driver support remain user-specific.",
    provenance: gpuProvenance(
      "AMD Radeon RX 9060 XT specifications",
      "https://www.amd.com/en/products/graphics/desktops/radeon/9000-series/amd-radeon-rx-9060xt.html",
      "2026-09-24",
    ),
  },
  {
    id: "nvidia-rtx-5060-8gb",
    slug: "rtx-5060-8gb",
    displayName: "GeForce RTX 5060 8GB",
    kind: "discrete",
    vendor: "NVIDIA",
    architecture: "Blackwell",
    vramGiB: 8,
    memoryType: "GDDR7",
    suitabilitySummary:
      "An 8 GiB Blackwell configuration for evaluating smaller quantized models; the catalog records capacity and makes no performance or runtime guarantee.",
    provenance: gpuProvenance(
      "NVIDIA GeForce RTX 5060 family specifications",
      "https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5060-family/",
      "2026-09-25",
    ),
  },
  {
    id: "nvidia-rtx-5060-ti-8gb",
    slug: "rtx-5060-ti-8gb",
    displayName: "GeForce RTX 5060 Ti 8GB",
    kind: "discrete",
    vendor: "NVIDIA",
    architecture: "Blackwell",
    vramGiB: 8,
    memoryType: "GDDR7",
    suitabilitySummary:
      "The 8 GiB RTX 5060 Ti configuration complements the catalog's 16 GiB version; memory capacity does not imply speed or guaranteed fit.",
    provenance: gpuProvenance(
      "NVIDIA GeForce RTX 5060 family specifications",
      "https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5060-family/",
      "2026-09-25",
    ),
  },
  {
    id: "amd-radeon-rx-7600-xt-16gb",
    slug: "radeon-rx-7600-xt-16gb",
    displayName: "Radeon RX 7600 XT 16GB",
    kind: "discrete",
    vendor: "AMD",
    architecture: "RDNA 3",
    vramGiB: 16,
    memoryType: "GDDR6",
    suitabilitySummary:
      "A 16 GiB RDNA 3 option in AMD's consumer range; LLMGauge reports dedicated memory capacity, not backend support or performance.",
    provenance: gpuProvenance(
      "AMD Radeon RX 7600 XT specifications",
      "https://www.amd.com/en/products/graphics/desktops/radeon/7000-series/amd-radeon-rx-7600-xt.html",
      "2026-09-25",
    ),
  },
  {
    id: "amd-radeon-rx-9060-xt-8gb",
    slug: "radeon-rx-9060-xt-8gb",
    displayName: "Radeon RX 9060 XT 8GB",
    kind: "discrete",
    vendor: "AMD",
    architecture: "RDNA 4",
    vramGiB: 8,
    memoryType: "GDDR6",
    suitabilitySummary:
      "The 8 GiB RX 9060 XT configuration complements the catalog's 16 GiB variant; selected-backend and driver support remain user-specific.",
    provenance: gpuProvenance(
      "AMD Radeon RX 9060 XT 8GB specifications",
      "https://www.amd.com/en/products/graphics/desktops/radeon/9000-series/amd-radeon-rx-9060xt-8gb.html",
      "2026-09-25",
    ),
  },
];
