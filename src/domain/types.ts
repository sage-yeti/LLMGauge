export type ModelFormat = "gguf" | "safetensors" | "other";
export type OperatingSystem = "windows" | "linux" | "macos" | "other";
export type ExecutionMode = "gpu" | "partial-offload" | "cpu" | "unsupported";
export type CompatibilityLevel =
  "unsupported" | "cpu-only" | "partial-offload" | "gpu-capable";
export type GpuKind = "discrete" | "integrated";
export type Runtime = "llama.cpp" | "ollama" | "other";
export type RuntimeProfileRuntime = "llama.cpp" | "unknown";
export type RuntimeBackend = "cpu" | "cuda" | "vulkan" | "metal" | "unknown";
export type ExecutionPreference =
  "automatic" | "full-gpu" | "partial-offload" | "cpu";
export type ProvenanceConfidence = "verified" | "approximate";
export type ProvenanceSourceType =
  | "official-model-card"
  | "official-documentation"
  | "manufacturer-specification"
  | "community-conversion"
  | "project-documentation"
  | "curated-estimate";

export interface CatalogProvenance {
  source: string;
  sourceUrl: string;
  sourceType: ProvenanceSourceType;
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

/** Optional, user-selected runtime planning inputs. These are advisory only. */
export interface RuntimeProfile {
  runtime?: RuntimeProfileRuntime;
  backend?: RuntimeBackend;
  executionPreference?: ExecutionPreference;
  targetContextLength?: number;
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
  license?: string;
  /** Publisher/runtime metadata; incomplete direct inputs produce unavailable guidance. */
  defaultContextLength?: number;
  maxContextLength?: number;
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
  contextGuidance: ContextGuidance;
  runtimeGuidance: RuntimeProfileGuidance;
  limitingFactors: string[];
  messages: string[];
  reasons: CompatibilityReason[];
  assumptions: CompatibilityAssumptions;
  warnings: string[];
}

export type CompatibilityReasonCode =
  | "approximate-estimate"
  | "approximate-context-assumption"
  | "model-context-limit"
  | "conservative-context-guidance"
  | "context-estimation-unavailable"
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

export type ContextGuidanceStatus = "available" | "unavailable";
export type ContextGuidanceConfidence = "medium" | "unknown";

export interface ContextGuidance {
  status: ContextGuidanceStatus;
  /** The model's published/context metadata limit, not a hardware estimate. */
  modelMaximumContextLength: number | null;
  /** A conservative starting point; null means the engine cannot calculate one. */
  recommendedContextLength: number | null;
  confidence: ContextGuidanceConfidence;
  message: string;
  assumptions: string[];
  reasonCodes: Extract<
    CompatibilityReasonCode,
    | "model-context-limit"
    | "conservative-context-guidance"
    | "context-estimation-unavailable"
    | "approximate-context-assumption"
  >[];
}

export type RuntimeContextAssessment =
  | "not-requested"
  | "within-guidance"
  | "above-practical-guidance"
  | "exceeds-model-maximum"
  | "unavailable";

export type RuntimeProfileReasonCode =
  | "runtime-profile-applied"
  | "runtime-profile-unknown"
  | "runtime-backend-unverified"
  | "execution-preference-advisory"
  | "target-context-within-guidance"
  | "target-context-above-guidance"
  | "target-context-exceeds-model-maximum"
  | "target-context-estimation-unavailable";

export interface RuntimeProfileGuidance {
  profile: RuntimeProfile;
  contextAssessment: RuntimeContextAssessment;
  requestedContextLength: number | null;
  assumptions: string[];
  warnings: string[];
  reasonCodes: RuntimeProfileReasonCode[];
}

export interface CompatibilityAssumptions {
  weightOverheadMultiplier: number;
  runtimeOverheadGiB: number;
  systemRamReserveGiB: number;
  availableMemorySafetyMarginGiB: number;
  defaultContextLength: number;
}

export type CompatibilityPolicy = CompatibilityAssumptions;
