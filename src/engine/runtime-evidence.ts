export type EvidenceAssessment =
  | "metadata-supported"
  | "conservative-policy"
  | "approximate-planning"
  | "currently-unknowable";

export interface RuntimeEvidenceEntry {
  id: string;
  scenario: string;
  expectedQualitativeBehavior: string;
  evidenceSource: string;
  sourceUrl: string;
  assessment: EvidenceAssessment;
  currentTreatment: string;
}

/**
 * Small source-backed review matrix. This records what the engine can defend
 * qualitatively; it is not a benchmark dataset or a runtime telemetry store.
 */
export const runtimeEvidenceMatrix: readonly RuntimeEvidenceEntry[] = [
  {
    id: "gguf-quantization-size",
    scenario:
      "A lower-bit GGUF candidate is compared with a higher-bit candidate.",
    expectedQualitativeBehavior:
      "Lower bits generally reduce weight storage, while quantization can introduce quality trade-offs.",
    evidenceSource: "llama.cpp quantization documentation",
    sourceUrl:
      "https://github.com/ggml-org/llama.cpp/blob/master/tools/quantize/README.md",
    assessment: "metadata-supported",
    currentTreatment:
      "The engine uses supplied bits-per-weight values to make an approximate planning estimate; it does not claim exact file size or quality.",
  },
  {
    id: "weight-memory-estimate",
    scenario:
      "Raw weight storage is estimated from parameter count and bits per weight.",
    expectedQualitativeBehavior:
      "Weight storage is only one part of runtime memory; model metadata and runtime buffers add uncertainty.",
    evidenceSource: "llama.cpp quantization and memory guidance",
    sourceUrl:
      "https://github.com/ggml-org/llama.cpp/blob/master/tools/quantize/README.md",
    assessment: "approximate-planning",
    currentTreatment:
      "The named formula, overhead multiplier, runtime overhead, and RAM reserve remain configurable heuristics rather than measured runtime requirements.",
  },
  {
    id: "gpu-layer-offload",
    scenario:
      "A model is larger than available dedicated VRAM but fits in system RAM.",
    expectedQualitativeBehavior:
      "llama.cpp can offload a maximum possible number of layers to a supported GPU, leaving other work outside VRAM.",
    evidenceSource: "llama.cpp GPU offload guidance",
    sourceUrl:
      "https://github.com/ggml-org/llama.cpp/blob/master/docs/development/token_generation_performance_tips.md",
    assessment: "metadata-supported",
    currentTreatment:
      "The engine reports partial offload qualitatively; it does not predict layer counts, transfer costs, backend support, or speed.",
  },
  {
    id: "context-size-memory",
    scenario: "A runtime context is increased on a model that otherwise fits.",
    expectedQualitativeBehavior:
      "Context size is a runtime setting and larger contexts consume additional memory; llama.cpp documentation notes KV-cache growth with context size.",
    evidenceSource: "llama.cpp multi-GPU documentation",
    sourceUrl:
      "https://github.com/ggml-org/llama.cpp/blob/master/docs/multi-gpu.md",
    assessment: "currently-unknowable",
    currentTreatment:
      "Context guidance is advisory and separate from classification because exact KV-cache cost depends on architecture, runtime settings, and backend details not present in the catalog.",
  },
  {
    id: "practical-context-default",
    scenario:
      "A model has a documented maximum context but no hardware-specific context measurement.",
    expectedQualitativeBehavior:
      "A smaller starting context is a planning choice, not a runtime guarantee or a replacement for the model limit.",
    evidenceSource: "llama.cpp CLI context-size documentation",
    sourceUrl:
      "https://github.com/ggml-org/llama.cpp/blob/master/tools/cli/README.md",
    assessment: "conservative-policy",
    currentTreatment:
      "LLMGauge uses the lower of the model default and configured 4,096-token policy and keeps it separate from compatibility classification.",
  },
  {
    id: "gemma-3-1b-context",
    scenario:
      "Gemma 3 1B IT context metadata is shown on the catalog and calculator.",
    expectedQualitativeBehavior:
      "The publisher documents 32K input context for the 1B variant; the 128K value applies to larger Gemma 3 variants.",
    evidenceSource: "Google Gemma 3 1B model card",
    sourceUrl: "https://huggingface.co/google/gemma-3-1b-it",
    assessment: "metadata-supported",
    currentTreatment:
      "The curated catalog records a 32,768-token maximum and keeps the 4,096-token practical starting policy separate from that model limit.",
  },
  {
    id: "exact-runtime-headroom",
    scenario:
      "A model estimate exactly meets the entered VRAM or system RAM value.",
    expectedQualitativeBehavior:
      "A nominal fit can still fail because available memory, runtime buffers, drivers, and other processes vary.",
    evidenceSource: "llama.cpp GPU offload diagnostics",
    sourceUrl:
      "https://github.com/ggml-org/llama.cpp/blob/master/docs/development/token_generation_performance_tips.md",
    assessment: "approximate-planning",
    currentTreatment:
      "The engine accepts exact estimated boundaries for deterministic behavior but emits an explicit headroom warning.",
  },
];
