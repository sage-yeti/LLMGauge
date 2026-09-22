import type {
  CatalogProvenance,
  GpuDefinition,
  HardwareProfile,
  ModelDefinition,
  QuantizationDefinition,
} from "@/domain/types";

export const fixtureProvenance: CatalogProvenance = {
  source: "LLMGauge curated seed data",
  confidence: "approximate",
  lastVerified: "2026-09-22",
  note: "Representative local-LLM fixture; values are approximate and not authoritative specifications.",
};

function quantization(
  id: string,
  displayName: string,
  bitsPerWeight: number,
  description: string,
): QuantizationDefinition {
  return {
    id,
    displayName,
    bitsPerWeight,
    description,
    provenance: fixtureProvenance,
  };
}

export const fixtureGpus: GpuDefinition[] = [
  {
    id: "gpu-12gb",
    slug: "example-12gb-gpu",
    displayName: "Example 12 GB GPU",
    kind: "discrete",
    vendor: "Example",
    architecture: "Representative discrete architecture",
    vramGiB: 12,
    suitabilitySummary:
      "A representative high-memory discrete GPU for larger quantized models.",
    provenance: fixtureProvenance,
  },
  {
    id: "gpu-8gb",
    slug: "example-8gb-gpu",
    displayName: "Example 8 GB GPU",
    kind: "discrete",
    vendor: "Example",
    architecture: "Representative discrete architecture",
    vramGiB: 8,
    suitabilitySummary:
      "A representative mid-range discrete GPU for small and medium quantized models.",
    provenance: fixtureProvenance,
  },
  {
    id: "gpu-4gb",
    slug: "example-4gb-gpu",
    displayName: "Example 4 GB GPU",
    kind: "discrete",
    vendor: "Example",
    architecture: "Representative discrete architecture",
    vramGiB: 4,
    suitabilitySummary:
      "A representative lower-memory discrete GPU where quantization and offload matter.",
    provenance: fixtureProvenance,
  },
  {
    id: "gpu-2gb",
    slug: "example-2gb-gpu",
    displayName: "Example 2 GB GPU",
    kind: "discrete",
    vendor: "Example",
    architecture: "Representative discrete architecture",
    vramGiB: 2,
    suitabilitySummary:
      "A representative low-memory discrete GPU, usually requiring partial offload.",
    provenance: fixtureProvenance,
  },
  {
    id: "gpu-integrated",
    slug: "example-integrated-gpu",
    displayName: "Example Integrated GPU",
    kind: "integrated",
    vendor: "Example",
    architecture: "Representative integrated architecture",
    vramGiB: 0,
    sharedMemoryGiB: 4,
    suitabilitySummary:
      "Shared-memory graphics; LLMGauge conservatively treats dedicated VRAM as unavailable.",
    provenance: fixtureProvenance,
  },
];

export const fixtureModel: ModelDefinition = {
  id: "example-7b",
  slug: "example-7b-instruct",
  displayName: "Example 7B Instruct",
  summary:
    "A representative medium-size instruction model for exercising the calculator.",
  family: "Example",
  provider: "LLMGauge fixtures",
  architecture: "Transformer",
  parameterCountBillions: 7,
  supportedFormats: ["gguf"],
  supportedRuntimes: ["llama.cpp", "ollama"],
  defaultContextLength: 4096,
  maxContextLength: 8192,
  quantizations: [
    quantization(
      "q4",
      "Q4",
      4,
      "Lower-memory option intended for broader hardware compatibility.",
    ),
    quantization(
      "q8",
      "Q8",
      8,
      "Higher-memory option that generally preserves more weight precision.",
    ),
  ],
  provenance: fixtureProvenance,
};

export const fixtureModels: ModelDefinition[] = [
  fixtureModel,
  {
    id: "example-3b",
    slug: "example-3b-instruct",
    displayName: "Example 3B Instruct",
    summary:
      "A representative small instruction model for lower-memory systems.",
    family: "Example",
    provider: "LLMGauge fixtures",
    architecture: "Transformer",
    parameterCountBillions: 3,
    supportedFormats: ["gguf"],
    supportedRuntimes: ["llama.cpp", "ollama"],
    defaultContextLength: 4096,
    maxContextLength: 8192,
    quantizations: [
      quantization(
        "q4",
        "Q4",
        4,
        "Lower-memory option intended for broader hardware compatibility.",
      ),
      quantization(
        "q8",
        "Q8",
        8,
        "Higher-memory option that generally preserves more weight precision.",
      ),
    ],
    provenance: fixtureProvenance,
  },
  {
    id: "example-13b",
    slug: "example-13b-instruct",
    displayName: "Example 13B Instruct",
    summary:
      "A representative larger instruction model for testing higher memory requirements.",
    family: "Example",
    provider: "LLMGauge fixtures",
    architecture: "Transformer",
    parameterCountBillions: 13,
    supportedFormats: ["gguf"],
    supportedRuntimes: ["llama.cpp", "ollama"],
    defaultContextLength: 4096,
    maxContextLength: 8192,
    quantizations: [
      quantization(
        "q4",
        "Q4",
        4,
        "Lower-memory option intended for broader hardware compatibility.",
      ),
      quantization(
        "q8",
        "Q8",
        8,
        "Higher-memory option that generally preserves more weight precision.",
      ),
    ],
    provenance: fixtureProvenance,
  },
];

export const fixtureHardware: Record<string, HardwareProfile> = {
  gpu: {
    cpu: { name: "Fixture CPU", physicalCores: 8 },
    gpu: {
      id: "gpu-12gb",
      name: "Example 12 GB GPU",
      kind: "discrete",
      vramGiB: 12,
    },
    systemRamGiB: 16,
    operatingSystem: "windows",
  },
  lowMemory: {
    cpu: { name: "Fixture CPU" },
    gpu: {
      id: "gpu-2gb",
      name: "Example 2 GB GPU",
      kind: "discrete",
      vramGiB: 2,
    },
    systemRamGiB: 16,
    operatingSystem: "linux",
  },
  cpuOnly: {
    cpu: { name: "Fixture CPU" },
    systemRamGiB: 16,
    operatingSystem: "linux",
  },
};
