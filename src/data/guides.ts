export type GuideSection = {
  heading: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

export type GuideReference = {
  label: string;
  url: string;
};

export type GuideLink = {
  label: string;
  href: string;
};

export type GuideDefinition = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  sections: readonly GuideSection[];
  references: readonly GuideReference[];
  lastReviewed: string;
  relatedLinks: readonly GuideLink[];
  relatedGuideSlugs: readonly string[];
};

const lastReviewed = "2026-09-22";

export const guideCatalog: readonly GuideDefinition[] = [
  {
    slug: "what-is-vram",
    title: "What Is VRAM?",
    summary:
      "A practical explanation of GPU memory and why it matters when running local language models.",
    description:
      "Learn what VRAM is, what model weights use it for, and why a local LLM estimate needs more than the file size.",
    category: "Hardware basics",
    sections: [
      {
        heading: "VRAM is memory attached to a GPU",
        paragraphs: [
          "VRAM is the memory a graphics processor uses for data it needs close at hand. When a local language model runs on a discrete GPU, some or all of its weights and working buffers can be placed in that memory.",
          "A GPU's advertised VRAM is a capacity number, not a promise that every byte is available to a model. The display, drivers, other applications, the runtime, and the operating system can all consume part of it.",
        ],
      },
      {
        heading: "Why model weights need memory",
        paragraphs: [
          "Model weights are the learned numbers that make the model behave as it does. More parameters generally mean more weight data. Quantization stores those numbers using fewer bits, which can make a model practical on a smaller GPU.",
          "The downloaded model file is only one part of the runtime picture. Loading and using a model also needs runtime buffers and memory for the active context, so a file that appears to fit exactly may still fail to load.",
        ],
      },
      {
        heading: "How LLMGauge uses VRAM",
        paragraphs: [
          "LLMGauge compares an approximate model requirement with the dedicated VRAM entered in the hardware profile. It leaves room for named runtime and safety assumptions instead of treating the VRAM number as fully available.",
          "The result is planning guidance. Actual free memory depends on your runtime, drivers, display session, context length, and what else is running on the computer.",
        ],
      },
    ],
    references: [
      {
        label: "llama.cpp README",
        url: "https://github.com/ggml-org/llama.cpp/blob/master/README.md",
      },
      {
        label: "llama.cpp model memory and GPU build guidance",
        url: "https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md",
      },
    ],
    lastReviewed,
    relatedLinks: [
      { label: "Try the compatibility calculator", href: "/" },
      { label: "See what your PC can run", href: "/recommendations" },
      { label: "GeForce RTX 4060 8GB", href: "/gpus/rtx-4060-8gb" },
    ],
    relatedGuideSlugs: ["context-length-and-memory", "compatibility-estimates"],
  },
  {
    slug: "llm-quantization",
    title: "What Is LLM Quantization?",
    summary:
      "Understand how lower-precision weights reduce memory use and introduce quality trade-offs.",
    description:
      "Learn how bits-per-weight and GGUF quantization affect local LLM memory planning, quality, and practical model choices.",
    category: "Model basics",
    sections: [
      {
        heading: "Quantization stores weights more compactly",
        paragraphs: [
          "Quantization changes how the model's numerical weights are represented. Instead of keeping every value at a higher precision, a quantized format uses fewer bits and a scheme for reconstructing useful values during inference.",
          "Fewer bits usually means less weight memory. It does not mean the model has fewer parameters: it is a more compact representation of the same learned structure.",
        ],
      },
      {
        heading: "Bits per weight is a useful planning signal",
        paragraphs: [
          "Bits-per-weight gives a rough way to compare memory pressure. A 4-bit candidate generally needs less weight storage than an 8-bit candidate for the same model, although metadata, packing, and runtime buffers mean the final file is not a perfect parameter-count multiplication.",
          "Names such as Q4_K_M, Q5_K_M, and Q8_0 identify particular quantization schemes. They should be treated as candidate formats, not as a universal quality ranking across every model family.",
        ],
      },
      {
        heading: "The practical trade-off",
        paragraphs: [
          "Higher-precision candidates usually preserve more numerical detail but require more memory. Lower-precision candidates can make a model fit on consumer hardware, but aggressive quantization can change outputs and may be a poor choice for a particular workload.",
          "LLMGauge recommends among the candidates recorded for a model. Its recommendation is based on fit and the supplied bits-per-weight metadata; it is not a benchmark, blind quality test, or guarantee that one conversion is best for every task.",
        ],
      },
    ],
    references: [
      {
        label: "llama.cpp quantization documentation",
        url: "https://github.com/ggml-org/llama.cpp/blob/master/tools/quantize/README.md",
      },
      {
        label: "Hugging Face quantization overview",
        url: "https://huggingface.co/docs/transformers/en/main_classes/quantization",
      },
    ],
    lastReviewed,
    relatedLinks: [
      { label: "Try the compatibility calculator", href: "/" },
      { label: "Llama 3.2 1B Instruct", href: "/models/llama-3-2-1b-instruct" },
      { label: "Qwen2.5 7B Instruct", href: "/models/qwen-2-5-7b-instruct" },
      { label: "Qwen3 4B", href: "/models/qwen3-4b" },
    ],
    relatedGuideSlugs: ["what-is-vram", "compatibility-estimates"],
  },
  {
    slug: "gpu-offloading",
    title: "GPU Offloading: Full, Partial, and CPU-Only",
    summary:
      "See what it means to run a local model entirely on a GPU, partly on a GPU, or on the CPU.",
    description:
      "Understand full GPU execution, partial GPU offload, and CPU-only execution in local llama.cpp-style runtimes.",
    category: "Runtime basics",
    sections: [
      {
        heading: "Full GPU execution",
        paragraphs: [
          "Full GPU execution means the runtime can place the model's relevant layers and buffers on a supported GPU within the available memory. This is often the simplest way to use a discrete GPU, but fitting the weights does not guarantee a particular speed.",
          "The runtime still needs a compatible backend and driver. A GPU listed in a hardware catalog is not the same thing as a tested configuration for every operating system or llama.cpp build.",
        ],
      },
      {
        heading: "Partial offload",
        paragraphs: [
          "Partial offload keeps some layers or buffers on the GPU and leaves the rest in system memory. It can make a model usable when the entire model does not fit in dedicated VRAM, but data has to move between memory pools and the result can be more sensitive to configuration.",
          "Because the split depends on the model, context, backend, and runtime settings, LLMGauge reports partial offload as a compatibility category rather than predicting a speed improvement.",
        ],
      },
      {
        heading: "CPU-only execution and integrated graphics",
        paragraphs: [
          "CPU-only execution means the model is planned for system RAM without relying on dedicated GPU memory. It can be the appropriate fallback when there is no discrete GPU or when GPU memory is insufficient.",
          "Integrated GPUs can share system memory, but the amount and behavior are platform-dependent. LLMGauge treats integrated/shared-memory graphics conservatively and does not count shared RAM as dedicated VRAM in its first-pass classification.",
        ],
      },
    ],
    references: [
      {
        label: "llama.cpp build and backend documentation",
        url: "https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md",
      },
      {
        label: "llama.cpp multi-GPU and layer-offload options",
        url: "https://github.com/ggml-org/llama.cpp/blob/master/docs/multi-gpu.md",
      },
    ],
    lastReviewed,
    relatedLinks: [
      { label: "See what your PC can run", href: "/recommendations" },
      { label: "GeForce RTX 3060 12GB", href: "/gpus/rtx-3060-12gb" },
      { label: "Intel UHD Graphics 770", href: "/gpus/intel-uhd-graphics-770" },
    ],
    relatedGuideSlugs: ["what-is-vram", "compatibility-estimates"],
  },
  {
    slug: "context-length-and-memory",
    title: "Context Length and Local LLM Memory",
    summary:
      "Why context length affects memory, how LLMGauge estimates supported KV caches, and what those estimates do not guarantee.",
    description:
      "Learn how to choose an explicit context target and interpret approximate KV-cache estimates and context limits.",
    category: "Runtime basics",
    sections: [
      {
        heading: "Context is the active conversation window",
        paragraphs: [
          "Context length is the number of tokens a runtime can keep available while responding. A token is a model-specific text unit, not exactly a word or character.",
          "A model publisher may document a maximum context length. That maximum describes the model configuration; it does not say that every computer can hold that much active context.",
        ],
      },
      {
        heading: "Choose an optional target in LLMGauge",
        paragraphs: [
          "The single-model calculator and recommendations workflow let you type a target context or choose one of four optional presets: 4,096, 8,192, 16,384, or 32,768 tokens. The field starts empty. No preset is a default, and LLMGauge does not turn a model's published default or maximum into a target for you.",
          "In recommendations, the target is checked separately against each model's own documented context limit. A target above that maximum produces an unavailable estimate. A published maximum is not a promise that your hardware can run the model at that context.",
        ],
      },
      {
        heading: "What the KV-cache estimate means",
        paragraphs: [
          "While a model responds, the runtime keeps working information about earlier tokens. This is commonly called a key-value cache, or KV cache. A longer target can require more cache memory in addition to the model weights and runtime buffers.",
          "LLMGauge shows an approximate FP16 cache estimate only when a model has supported, sourced architecture metadata. Supported text-only Llama catalog entries are Llama 3.1 8B Instruct, Llama 3.2 1B and 3B Instruct, and Llama 3.3 70B Instruct. Other supported entries are dense Qwen3 4B, 8B, 14B, and 32B, Qwen3-30B-A3B-Instruct-2507, and Qwen3-Coder-30B-A3B-Instruct. Cache estimates remain unavailable for other architectures.",
          "The estimate uses 2 × transformer layers × KV heads × head dimension × 2 bytes × target context tokens, then divides by 2^30 to report GiB. The first 2 accounts for keys and values; 2 bytes is the FP16 assumption. The inputs come from sourced architecture metadata and the target you explicitly entered or selected.",
          "The interface rounds the displayed size for readability. Fit assessment uses the unrounded estimate, so display rounding does not change the fit decision.",
        ],
      },
      {
        heading: "When the cache affects fit",
        paragraphs: [
          "A cache estimate affects memory fit only when the selected execution path identifies its placement. Explicit CPU execution counts it in system RAM. An explicit full-GPU choice with a CUDA or Vulkan backend and a discrete GPU counts it in dedicated VRAM. Apple unified-memory mode counts it in the single shared memory pool.",
          "With automatic or partial-offload execution, or any otherwise unverified placement, LLMGauge still shows a supported estimate but excludes it from fit accounting. Placement remains advisory because the app cannot confirm how a particular runtime allocates memory.",
        ],
      },
      {
        heading: "Use the result as planning guidance",
        paragraphs: [
          "Start with a target that fits the work you actually do and leave memory headroom. The cache estimate is approximate, not a measurement of a running process.",
          "A model's documented maximum is not a recommendation for your hardware. Runtime versions, backends, drivers, operating systems, other applications, and model-specific behavior can all affect whether a configuration runs. LLMGauge does not guarantee backend support or predict performance.",
        ],
      },
    ],
    references: [
      {
        label: "llama.cpp README and runtime project documentation",
        url: "https://github.com/ggml-org/llama.cpp/blob/master/README.md",
      },
      {
        label: "llama.cpp KV-cache implementation",
        url: "https://github.com/ggml-org/llama.cpp/blob/master/src/llama-kv-cache.cpp",
      },
      {
        label: "Meta Llama model architecture list",
        url: "https://github.com/meta-llama/llama-models/blob/main/models/sku_list.py",
      },
      {
        label: "Qwen3 4B official configuration",
        url: "https://huggingface.co/Qwen/Qwen3-4B/blob/main/config.json",
      },
      {
        label: "Qwen3-30B-A3B-Instruct-2507 official configuration",
        url: "https://huggingface.co/Qwen/Qwen3-30B-A3B-Instruct-2507/blob/main/config.json",
      },
      {
        label: "Qwen3-Coder-30B-A3B-Instruct official configuration",
        url: "https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct/blob/main/config.json",
      },
      {
        label: "NVIDIA model profile memory guidance",
        url: "https://docs.nvidia.com/nim/large-language-models/latest/deployment/model-profiles-and-selection.html",
      },
    ],
    lastReviewed: "2026-10-03",
    relatedLinks: [
      { label: "Check one model in the calculator", href: "/" },
      { label: "See model recommendations", href: "/recommendations" },
      {
        label: "Compare discrete GPUs for a model",
        href: "/gpu-compatibility",
      },
      {
        label: "How compatibility estimates work",
        href: "/guides/compatibility-estimates",
      },
      {
        label: "Mistral 7B Instruct v0.3",
        href: "/models/mistral-7b-instruct-v0-3",
      },
      { label: "Gemma 3 12B IT", href: "/models/gemma-3-12b-it" },
    ],
    relatedGuideSlugs: [
      "what-is-vram",
      "gpu-offloading",
      "compatibility-estimates",
    ],
  },
  {
    slug: "compatibility-estimates",
    title: "How LLMGauge Compatibility Estimates Work",
    summary:
      "Understand what the calculator checks, how explicit KV-cache estimates affect fit, and where uncertainty remains.",
    description:
      "A plain-language guide to compatibility estimates, explicit context targets, cache placement, and limitations.",
    category: "Using LLMGauge",
    sections: [
      {
        heading: "What the calculator evaluates",
        paragraphs: [
          "LLMGauge accepts a hardware profile, a catalog model, and a quantization candidate. It estimates weight memory from cataloged model or file-size inputs, applies named overhead assumptions, and compares the result with available memory.",
          "The recommendations workflow sends the same hardware profile through the same compatibility engine for each catalog candidate. The GPU comparison workflow asks for one model and an explicit system RAM amount, then evaluates each catalogued discrete GPU with the existing representative-quantization policy. It does not use a separate formula or a hidden ranking model.",
        ],
      },
      {
        heading: "Context targets and supported KV-cache estimates",
        paragraphs: [
          "A context target is optional and must be entered or selected explicitly. Both workflows offer 4,096, 8,192, 16,384, and 32,768 token presets; they are quick choices, not defaults. LLMGauge does not infer a target from a model's published default or maximum. In recommendations, the target is evaluated against each model's own documented maximum. A target above that maximum makes the estimate unavailable, and the maximum does not mean the user's hardware can run that context.",
          "For supported sourced architectures, LLMGauge estimates the FP16 key-value (KV) cache using 2 × transformer layers × KV heads × head dimension × 2 bytes × target context tokens, divided by 2^30 to get GiB. The supported text-only Llama catalog entries are Llama 3.1 8B Instruct, Llama 3.2 1B and 3B Instruct, and Llama 3.3 70B Instruct. Other supported entries are dense Qwen3 4B, 8B, 14B, and 32B, Qwen3-30B-A3B-Instruct-2507, and Qwen3-Coder-30B-A3B-Instruct. Cache estimates remain unavailable for other architectures.",
          "Displayed cache sizes are rounded for readability; fit decisions use the underlying unrounded values. An unavailable estimate is not treated as zero.",
        ],
      },
      {
        heading: "When the cache enters the fit decision",
        paragraphs: [
          "Cache memory is counted only when the chosen execution settings establish its placement: explicit CPU execution counts it in system RAM; an explicit full-GPU choice with CUDA or Vulkan and a discrete GPU counts it in VRAM; Apple unified-memory mode counts it in its single memory pool.",
          "Automatic, partial-offload, and otherwise unverified placements remain visible as advisory cache estimates but are excluded from fit accounting. The application does not know how a particular runtime allocates the cache.",
        ],
      },
      {
        heading: "What the result categories mean",
        bullets: [
          "GPU-capable: the estimate fits the available dedicated GPU memory under the current policy.",
          "Partial offload: the full estimate does not fit dedicated VRAM, but the combined memory picture allows a conservative split between GPU and system memory.",
          "CPU-only: the model is planned for system memory without relying on a discrete GPU, including the current conservative treatment of integrated graphics.",
          "Unsupported: the candidate exceeds the available memory pools or has no valid quantization candidate that fits.",
        ],
        paragraphs: [
          "These labels describe memory planning, not speed, quality, driver compatibility, or a guarantee that a particular downloaded file will run.",
        ],
      },
      {
        heading: "Why an estimate is not a guarantee",
        paragraphs: [
          "Real requirements vary with the exact model file, quantization conversion, target context, runtime version, backend, driver, operating system, display use, and other programs competing for memory. A documented context maximum is not a prediction that the selected hardware can use it.",
          "LLMGauge uses sourced catalog metadata and explicit assumptions. It does not benchmark your computer, verify that a backend supports a model, or promise a particular memory allocation or performance.",
          "Use the result as a starting point, then verify the exact model and runtime on your own system. Leave extra memory headroom when a result is close to the boundary.",
        ],
      },
    ],
    references: [
      {
        label: "llama.cpp README and runtime project documentation",
        url: "https://github.com/ggml-org/llama.cpp/blob/master/README.md",
      },
      {
        label: "llama.cpp model loader",
        url: "https://github.com/ggml-org/llama.cpp/blob/master/src/llama-model.cpp",
      },
      {
        label: "llama.cpp KV-cache implementation",
        url: "https://github.com/ggml-org/llama.cpp/blob/master/src/llama-kv-cache.cpp",
      },
      {
        label: "Meta Llama model architecture list",
        url: "https://github.com/meta-llama/llama-models/blob/main/models/sku_list.py",
      },
      {
        label: "Qwen3 4B official configuration",
        url: "https://huggingface.co/Qwen/Qwen3-4B/blob/main/config.json",
      },
      {
        label: "Qwen3-30B-A3B-Instruct-2507 official configuration",
        url: "https://huggingface.co/Qwen/Qwen3-30B-A3B-Instruct-2507/blob/main/config.json",
      },
      {
        label: "Qwen3-Coder-30B-A3B-Instruct official configuration",
        url: "https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct/blob/main/config.json",
      },
      {
        label: "llama.cpp quantization documentation",
        url: "https://github.com/ggml-org/llama.cpp/blob/master/tools/quantize/README.md",
      },
    ],
    lastReviewed: "2026-10-03",
    relatedLinks: [
      { label: "Open the compatibility calculator", href: "/" },
      { label: "Get model recommendations", href: "/recommendations" },
      {
        label: "Compare discrete GPUs for a model",
        href: "/gpu-compatibility",
      },
      {
        label: "Read about context length and memory",
        href: "/guides/context-length-and-memory",
      },
      { label: "Intel Arc B580 12GB", href: "/gpus/arc-b580-12gb" },
    ],
    relatedGuideSlugs: [
      "what-is-vram",
      "gpu-offloading",
      "context-length-and-memory",
    ],
  },
];

export function getGuideBySlug(slug: string): GuideDefinition | undefined {
  return guideCatalog.find((guide) => guide.slug === slug);
}