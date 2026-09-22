export type ModelFormat = "gguf" | "safetensors" | "other";
export type OperatingSystem = "windows" | "linux" | "macos" | "other";
export type ExecutionMode = "gpu" | "partial-offload" | "cpu" | "unsupported";
export type CompatibilityLevel =
  "unsupported" | "cpu-only" | "partial-offload" | "gpu-capable";
export type GpuKind = "discrete" | "integrated";
export type Runtime = "llama.cpp" | "ollama" | "other";
export type ProvenanceConfidence = "verified" | "approximate";

export interface CatalogProvenance {
  source: string;
  sourceUrl?: string;
  confidence: ProvenanceConfidence;
  lastVerified: string;
  note?: string;
}

export interface CpuInfo {
  name: string;
  physicalCores?: number;
}
export interface GpuInfo {
  id: string;
  name: string;
  kind: GpuKind;
  /** Dedicated VRAM. Integrated GPUs may legitimately report zero. */
  vramGiB: number;
  /** Optional memory that an integrated GPU may borrow from system RAM. */
  sharedMemoryGiB?: number;
}

export interface HardwareProfile {
  cpu: CpuInfo;
  gpu?: GpuInfo;
  systemRamGiB: number;
  operatingSystem: OperatingSystem;
}

export interface QuantizationDefinition {
  id: string;
  displayName: string;
  bitsPerWeight: number;
  sizeGiB?: number;
  overheadMultiplier?: number;
  description?: string;
  provenance: CatalogProvenance;
}

export interface ModelDefinition {
  id: string;
  slug: string;
  displayName: string;
  summary: string;
  family: string;
  provider: string;
  architecture: string;
  parameterCountBillions: number;
  supportedFormats: ModelFormat[];
  supportedRuntimes: Runtime[];
  defaultContextLength: number;
  maxContextLength: number;
  quantizations: QuantizationDefinition[];
  provenance: CatalogProvenance;
}

export interface GpuDefinition {
  id: string;
  slug: string;
  displayName: string;
  kind: GpuKind;
  vendor: string;
  architecture?: string;
  vramGiB: number;
  sharedMemoryGiB?: number;
  suitabilitySummary: string;
  provenance: CatalogProvenance;
}

export interface MemoryEstimate {
  modelWeightsGiB: number;
  runtimeOverheadGiB: number;
  estimatedVramGiB: number;
  estimatedSystemRamGiB: number;
}

export interface CompatibilityResult {
  modelId: string;
  quantizationId: string;
  level: CompatibilityLevel;
  executionMode: ExecutionMode;
  memory: MemoryEstimate;
  recommendedQuantizationId: string | null;
  contextLengthGuidance: string;
  limitingFactors: string[];
  messages: string[];
  reasons: CompatibilityReason[];
  assumptions: CompatibilityAssumptions;
  warnings: string[];
}

export type CompatibilityReasonCode =
  | "approximate-estimate"
  | "insufficient-vram"
  | "partial-offload"
  | "insufficient-system-ram"
  | "no-discrete-gpu"
  | "integrated-shared-memory"
  | "exact-memory-boundary"
  | "safety-margin";

export interface CompatibilityReason {
  code: CompatibilityReasonCode;
  severity: "info" | "warning" | "blocking";
  message: string;
}

export interface CompatibilityAssumptions {
  weightOverheadMultiplier: number;
  runtimeOverheadGiB: number;
  systemRamReserveGiB: number;
  availableMemorySafetyMarginGiB: number;
  defaultContextLength: number;
}

export type CompatibilityPolicy = CompatibilityAssumptions;
