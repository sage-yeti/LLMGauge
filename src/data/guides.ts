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
      "Why the amount of text a model can consider affects memory beyond the weight file.",
    description:
      "Learn what context length means, why larger contexts can require more memory, and why practical limits vary by runtime.",
    category: "Runtime basics",
    sections: [
      {
        heading: "Context is the active conversation window",
        paragraphs: [
          "Context length is the number of tokens a runtime can keep available as input and recent conversation for a request. A token is a model-specific text unit, not exactly a word or character.",
          "A model card may document a maximum context, but that maximum is not automatically a sensible setting for every computer. The runtime, backend, batch settings, and available memory all matter.",
        ],
      },
      {
        heading: "Why more context needs more memory",
        paragraphs: [
          "The runtime maintains attention-related state for the active context, commonly described as a key-value cache. As the context grows, that state can take more memory in addition to the model weights and runtime buffers.",
          "This means a model can load at a short context but fail, slow down, or leave less headroom at a much larger context. The exact cost depends on architecture and runtime settings, so a simple public estimate should not pretend to calculate it exactly.",
        ],
      },
      {
        heading: "How to use the guidance",
        paragraphs: [
          "Start with a context length that matches the work you actually do and leave memory headroom. If a setup is close to the boundary, reducing context can be more useful than immediately choosing a much lower-quality quantization.",
          "LLMGauge shows model context metadata and gives approximate compatibility guidance. It does not promise that the published maximum context will fit on your hardware or predict a tokens-per-second result.",
        ],
      },
    ],
    references: [
      {
        label: "llama.cpp command-line and backend documentation",
        url: "https://github.com/ggml-org/llama.cpp/blob/master/README.md",
      },
      {
        label: "NVIDIA model profile memory guidance",
        url: "https://docs.nvidia.com/nim/large-language-models/latest/deployment/model-profiles-and-selection.html",
      },
    ],
    lastReviewed,
    relatedLinks: [
      { label: "Try the compatibility calculator", href: "/" },
      {
        label: "Mistral 7B Instruct v0.3",
        href: "/models/mistral-7b-instruct-v0-3",
      },
    ],
    relatedGuideSlugs: ["what-is-vram", "llm-quantization"],
  },
  {
    slug: "compatibility-estimates",
    title: "How LLMGauge Compatibility Estimates Work",
    summary:
      "Understand what the calculator checks, what its result categories mean, and where uncertainty remains.",
    description:
      "A plain-language guide to LLMGauge's deterministic compatibility estimates, assumptions, classifications, and limitations.",
    category: "Using LLMGauge",
    sections: [
      {
        heading: "What the calculator evaluates",
        paragraphs: [
          "LLMGauge accepts a hardware profile, a catalog model, and a quantization candidate. It estimates weight memory from parameter count and bits per weight, adds named overhead assumptions, and compares the result with dedicated VRAM and system RAM.",
          "The recommendation workflow repeats the same engine evaluation across the curated catalog. The UI does not contain a second formula or a hidden ranking model.",
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
          "Real requirements vary with the exact model file, quantization conversion, context length, runtime version, backend, driver, operating system, display use, and other programs competing for memory.",
          "The initial LLMGauge policy is intentionally transparent: raw weights are estimated from parameters and bits per weight, a named weight overhead and runtime overhead are added, and system RAM reserves are included. Those assumptions are useful for comparison but are not benchmark measurements.",
          "Use the result to choose a sensible starting point, then verify the exact model and runtime on your own system. A result near the boundary deserves extra headroom.",
        ],
      },
    ],
    references: [
      {
        label: "llama.cpp README and runtime project documentation",
        url: "https://github.com/ggml-org/llama.cpp/blob/master/README.md",
      },
      {
        label: "llama.cpp quantization documentation",
        url: "https://github.com/ggml-org/llama.cpp/blob/master/tools/quantize/README.md",
      },
    ],
    lastReviewed,
    relatedLinks: [
      { label: "Open the compatibility calculator", href: "/" },
      { label: "Get model recommendations", href: "/recommendations" },
      { label: "Read about VRAM", href: "/guides/what-is-vram" },
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
