import {
  modelDefinitionSchema,
  modelMetadataSchema,
  hardwareProfileSchema,
  quantizationSchema,
} from "@/domain/schemas";
import type {
  CompatibilityPolicy,
  CompatibilityReason,
  CompatibilityResult,
  ContextGuidance,
  HardwareProfile,
  ModelDefinition,
  MemoryEstimate,
  KvCacheAssessment,
  QuantizationDefinition,
  RuntimeProfile,
} from "@/domain/types";
import { DEFAULT_COMPATIBILITY_POLICY } from "./assumptions";
import { buildRuntimeProfileGuidance } from "./runtime-profile";
import { compareQuantizationMetadata } from "@/domain/quantization-order";

export function estimateMemory(
  model: ModelDefinition,
  quantization: QuantizationDefinition,
  policy: CompatibilityPolicy = DEFAULT_COMPATIBILITY_POLICY,
): MemoryEstimate {
  validatePolicy(policy);
  const validQuantization = quantizationSchema.safeParse(quantization);
  if (!validQuantization.success)
    throw new Error(
      formatValidationError(
        "Invalid quantization definition",
        validQuantization.error,
      ),
    );
  let modelWeightsGiB: number;
  if (quantization.sizeGiB !== undefined) {
    modelWeightsGiB = quantization.sizeGiB;
  } else if (quantization.bitsPerWeight !== undefined) {
    modelWeightsGiB =
      (model.parameterCountBillions *
        1_000_000_000 *
        quantization.bitsPerWeight) /
      8 /
      2 ** 30;
  } else {
    throw new Error("Quantization requires sizeGiB or bitsPerWeight");
  }
  const overhead =
    quantization.overheadMultiplier ?? policy.weightOverheadMultiplier;
  const estimatedVramGiB =
    modelWeightsGiB * overhead + policy.runtimeOverheadGiB;
  return {
    modelWeightsGiB,
    runtimeOverheadGiB: policy.runtimeOverheadGiB,
    estimatedVramGiB,
    estimatedSystemRamGiB: estimatedVramGiB + policy.systemRamReserveGiB,
  };
}

export function evaluateCompatibility(
  hardware: HardwareProfile,
  model: ModelDefinition,
  quantization: QuantizationDefinition,
  policy: CompatibilityPolicy = DEFAULT_COMPATIBILITY_POLICY,
  runtimeProfile?: RuntimeProfile,
): CompatibilityResult {
  const validHardware = hardwareProfileSchema.safeParse(hardware);
  const validModel = modelDefinitionSchema.safeParse(model);
  if (!validHardware.success) {
    throw new Error(
      formatValidationError(
        "Invalid hardware or model definition",
        validHardware.error,
      ),
    );
  }
  if (!validModel.success)
    throw new Error(
      formatValidationError(
        "Invalid hardware or model definition",
        validModel.error,
      ),
    );
  if (model.quantizations.length === 0)
    throw new Error("Model has no quantization candidates");
  const validQuantization = quantizationSchema.safeParse(quantization);
  if (!validQuantization.success)
    throw new Error(
      formatValidationError(
        "Invalid quantization definition",
        validQuantization.error,
      ),
    );
  if (
    !model.quantizations.some((candidate) => candidate.id === quantization.id)
  )
    throw new Error("Quantization is not available for this model");
  validatePolicy(policy);
  const appleUnified = hardware.memoryMode === "apple-unified";
  const baseMemory = estimateMemory(model, quantization, policy);
  const contextGuidance = buildContextGuidance(model, policy);
  const runtimeGuidance = buildRuntimeProfileGuidance(
    runtimeProfile,
    contextGuidance,
  );
  const kvCache = estimateKvCache(model, hardware, runtimeProfile);
  const memory = applyKvCacheToMemory(baseMemory, kvCache);
  const vram = hardware.gpu?.vramGiB ?? 0;
  const requiredVramGiB =
    memory.estimatedVramGiB + policy.availableMemorySafetyMarginGiB;
  const requiredSystemRamGiB =
    memory.estimatedSystemRamGiB + policy.availableMemorySafetyMarginGiB;
  const vramCanHoldModel = vram >= requiredVramGiB;
  const ramCanHoldModel = hardware.systemRamGiB >= requiredSystemRamGiB;
  let level: CompatibilityResult["level"];
  let executionMode: CompatibilityResult["executionMode"];
  const reasons: CompatibilityReason[] = [
    {
      code: "approximate-estimate",
      severity: "warning",
      message:
        "This is a deterministic memory estimate, not a benchmark or performance guarantee.",
    },
  ];
  reasons.push(...contextGuidanceReasons(contextGuidance));
  if (kvCache.status === "unavailable") {
    reasons.push({
      code: "kv-cache-estimate-unavailable",
      severity: "warning",
      message: kvCache.reason,
    });
  } else if (!kvCache.includedInFit) {
    reasons.push({
      code: "kv-cache-placement-unverified",
      severity: "warning",
      message:
        "The KV-cache estimate is advisory and is excluded from this fit assessment because its memory placement is not established by the selected settings.",
    });
  } else {
    reasons.push({
      code: "kv-cache-included",
      severity: "info",
      message: `The estimated FP16 KV cache (${kvCache.sizeGiB!.toFixed(2)} GiB) is included in the ${kvCache.placement === "vram" ? "VRAM" : kvCache.placement === "system-ram" ? "system RAM" : "unified-memory"} fit requirement.`,
    });
  }
  if (policy.availableMemorySafetyMarginGiB > 0)
    reasons.push({
      code: "safety-margin",
      severity: "warning",
      message: `A conservative ${policy.availableMemorySafetyMarginGiB} GiB safety margin is included in the fit check.`,
    });
  if (appleUnified) {
    level = ramCanHoldModel ? "unified-memory-fit" : "unsupported";
    executionMode = ramCanHoldModel ? "unverified" : "unsupported";
    reasons.push({
      code: "unified-execution-unverified",
      severity: "warning",
      message:
        "Actual CPU/Metal execution and GPU allocation depend on the runtime and macOS. Total unified-memory fit does not guarantee full GPU offload; Metal working-set limits and backend availability are unverified.",
    });
    if (!ramCanHoldModel)
      reasons.push({
        code: "insufficient-unified-memory",
        severity: "blocking",
        message:
          "Total unified memory is below the estimated pooled requirement, including the RAM reserve and safety margin.",
      });
  } else if (vramCanHoldModel && ramCanHoldModel) {
    level = "gpu-capable";
    executionMode = "gpu";
  } else if (ramCanHoldModel) {
    level = vram > 0 ? "partial-offload" : "cpu-only";
    executionMode = vram > 0 ? "partial-offload" : "cpu";
    if (vram > 0) {
      reasons.push({
        code: "insufficient-vram",
        severity: "warning",
        message:
          "Available VRAM is below the estimated requirement; some layers must use system RAM.",
      });
      reasons.push({
        code: "partial-offload",
        severity: "warning",
        message:
          "System RAM is sufficient for the estimate, so partial GPU offload is possible.",
      });
    }
  } else {
    level = "unsupported";
    executionMode = "unsupported";
    reasons.push({
      code: "insufficient-system-ram",
      severity: "blocking",
      message: "Available system RAM is below the estimated requirement.",
    });
    if (hardware.gpu && !vramCanHoldModel)
      reasons.push({
        code: "insufficient-vram",
        severity: "blocking",
        message: "Available VRAM is below the estimated requirement.",
      });
  }
  if (!appleUnified && !hardware.gpu)
    reasons.push({
      code: "no-discrete-gpu",
      severity: "info",
      message: "No GPU was supplied, so execution is CPU-only.",
    });
  if (hardware.gpu?.kind === "integrated")
    reasons.push({
      code: "integrated-shared-memory",
      severity: "warning",
      message: "Integrated GPU shared memory is not counted as dedicated VRAM.",
    });
  if (
    (!appleUnified && vram === requiredVramGiB) ||
    hardware.systemRamGiB === requiredSystemRamGiB
  )
    reasons.push({
      code: "exact-memory-boundary",
      severity: "info",
      message:
        "This result sits exactly at an estimated memory boundary; real runtime headroom may be lower.",
    });
  const limitingFactors = reasons
    .filter(
      (reason) =>
        reason.code === "insufficient-vram" ||
        reason.code === "partial-offload" ||
        reason.code === "insufficient-system-ram" ||
        reason.code === "insufficient-unified-memory" ||
        reason.code === "no-discrete-gpu",
    )
    .map((reason) => reason.message);
  const warnings = reasons
    .filter(
      (reason) =>
        reason.code === "approximate-estimate" ||
        reason.code === "approximate-context-assumption" ||
        reason.code === "conservative-context-guidance" ||
        reason.code === "context-estimation-unavailable" ||
        reason.code === "safety-margin" ||
        reason.code === "integrated-shared-memory" ||
        reason.code === "unified-execution-unverified" ||
        reason.code === "kv-cache-estimate-unavailable" ||
        reason.code === "kv-cache-placement-unverified",
    )
    .map((reason) => reason.message);
  return {
    modelId: model.id,
    quantizationId: quantization.id,
    level,
    executionMode,
    memory: appleUnified
      ? {
          ...memory,
          estimatedVramGiB: null,
          estimatedUnifiedMemoryGiB: memory.estimatedSystemRamGiB,
        }
      : memory,
    recommendedQuantizationId: null,
    contextGuidance,
    runtimeGuidance,
    kvCache,
    limitingFactors,
    messages: [
      `${model.displayName} (${quantization.displayName}) is classified as ${level}.`,
    ],
    reasons,
    assumptions: { ...policy },
    warnings,
  };
}

/** Estimate conventional FP16 K/V cache only from model-specific sourced metadata. */
export function estimateKvCache(
  model: ModelDefinition,
  hardware: HardwareProfile,
  runtimeProfile?: RuntimeProfile,
): KvCacheAssessment {
  const targetContextLength = runtimeProfile?.targetContextLength ?? null;
  const unavailable = (reason: string): KvCacheAssessment => ({
    status: "unavailable",
    sizeGiB: null,
    targetContextLength,
    precision: "FP16",
    placement: "unavailable",
    includedInFit: false,
    reason,
    sourceUrl: null,
  });
  if (targetContextLength === null)
    return unavailable(
      "KV-cache memory is unavailable because no target context was supplied; no model maximum or default is substituted.",
    );
  if (!model.kvCacheMetadata)
    return unavailable(
      "KV-cache memory is unavailable because this model's attention-cache architecture metadata is not sourced and supported by this estimate.",
    );
  if (
    model.maxContextLength !== undefined &&
    targetContextLength > model.maxContextLength
  )
    return unavailable(
      `KV-cache memory is unavailable because the target context exceeds the documented model maximum of ${model.maxContextLength.toLocaleString()} tokens.`,
    );

  const { transformerLayers, keyValueHeads, headDimension } =
    model.kvCacheMetadata;
  const sizeGiB =
    (2 *
      transformerLayers *
      keyValueHeads *
      headDimension *
      2 *
      targetContextLength) /
    2 ** 30;
  if (!Number.isFinite(sizeGiB))
    return unavailable(
      "KV-cache memory could not be represented as a finite estimate.",
    );

  if (hardware.memoryMode === "apple-unified")
    return {
      status: "estimated",
      sizeGiB,
      targetContextLength,
      precision: "FP16",
      placement: "unified-memory",
      includedInFit: true,
      reason:
        "The cache is included in the single pooled-memory requirement; actual CPU/Metal allocation remains unverified.",
      sourceUrl: model.kvCacheMetadata.provenance.sourceUrl,
    };

  const profile = runtimeProfile ?? {};
  const explicitCpu =
    (profile.executionPreference === "cpu" &&
      (!profile.backend || profile.backend === "cpu")) ||
    (profile.backend === "cpu" &&
      (!profile.executionPreference || profile.executionPreference === "cpu"));
  if (explicitCpu)
    return {
      status: "estimated",
      sizeGiB,
      targetContextLength,
      precision: "FP16",
      placement: "system-ram",
      includedInFit: true,
      reason:
        "The selected CPU execution setting places the cache estimate in system RAM.",
      sourceUrl: model.kvCacheMetadata.provenance.sourceUrl,
    };

  if (
    profile.executionPreference === "full-gpu" &&
    (profile.backend === "cuda" || profile.backend === "vulkan") &&
    hardware.gpu?.kind === "discrete" &&
    hardware.gpu.vramGiB > 0
  )
    return {
      status: "estimated",
      sizeGiB,
      targetContextLength,
      precision: "FP16",
      placement: "vram",
      includedInFit: true,
      reason:
        "The selected full-GPU preference and explicit CUDA/Vulkan backend assign the cache estimate to dedicated VRAM; actual loading remains unverified.",
      sourceUrl: model.kvCacheMetadata.provenance.sourceUrl,
    };

  return {
    status: "estimated",
    sizeGiB,
    targetContextLength,
    precision: "FP16",
    placement: "unverified",
    includedInFit: false,
    reason:
      "The FP16 KV-cache estimate is available, but automatic, partial-offload, or unspecified execution does not establish its RAM/VRAM placement.",
    sourceUrl: model.kvCacheMetadata.provenance.sourceUrl,
  };
}

function applyKvCacheToMemory(
  base: MemoryEstimate,
  kvCache: KvCacheAssessment,
): MemoryEstimate {
  if (kvCache.status !== "estimated" || !kvCache.includedInFit) return base;
  const cacheGiB = kvCache.sizeGiB!;
  if (kvCache.placement === "vram")
    return {
      ...base,
      estimatedVramGiB: base.estimatedVramGiB + cacheGiB,
      estimatedSystemRamGiB: base.estimatedSystemRamGiB,
    };
  return {
    ...base,
    estimatedVramGiB: base.estimatedVramGiB,
    estimatedSystemRamGiB: base.estimatedSystemRamGiB + cacheGiB,
  };
}

/**
 * Produces practical context guidance separately from KV-cache estimation.
 * The advisory recommendation itself does not change compatibility.
 */
export function buildContextGuidance(
  model: ModelDefinition,
  policy: CompatibilityPolicy = DEFAULT_COMPATIBILITY_POLICY,
): ContextGuidance {
  validatePolicy(policy);
  const modelMaximumContextLength = isPositiveInteger(model.maxContextLength)
    ? model.maxContextLength
    : null;
  const hasUsableMetadata =
    isPositiveInteger(model.defaultContextLength) &&
    isPositiveInteger(model.maxContextLength) &&
    model.maxContextLength >= model.defaultContextLength;

  if (!hasUsableMetadata) {
    return {
      status: "unavailable",
      modelMaximumContextLength,
      recommendedContextLength: null,
      confidence: "unknown",
      message:
        "A practical context recommendation is unavailable because this model's context metadata is incomplete or inconsistent.",
      assumptions: [
        "KV-cache memory is estimated separately only when an explicit target context and supported sourced architecture metadata are available.",
        "Use the model documentation and start with a conservative context after confirming the runtime supports it.",
      ],
      reasonCodes: [
        "context-estimation-unavailable",
        "approximate-context-assumption",
      ],
    };
  }

  const defaultContextLength = model.defaultContextLength!;
  const maxContextLength = model.maxContextLength!;

  const recommendedContextLength = Math.min(
    defaultContextLength,
    maxContextLength,
    policy.defaultContextLength,
  );
  return {
    status: "available",
    modelMaximumContextLength: maxContextLength,
    recommendedContextLength,
    confidence: "medium",
    message: `Start around ${recommendedContextLength.toLocaleString()} tokens. The model metadata allows up to ${maxContextLength.toLocaleString()} tokens, but larger contexts require additional memory and may be impractical on this hardware.`,
    assumptions: [
      "The recommendation uses the lower of the model default context and the configured conservative default.",
      "The practical starting point is context guidance only; a separate target context is required for the KV-cache estimate.",
    ],
    reasonCodes: [
      "model-context-limit",
      "conservative-context-guidance",
      "approximate-context-assumption",
    ],
  };
}

export function recommendQuantization(
  hardware: HardwareProfile,
  model: ModelDefinition,
  policy: CompatibilityPolicy = DEFAULT_COMPATIBILITY_POLICY,
  runtimeProfile?: RuntimeProfile,
): CompatibilityResult | undefined {
  hardwareProfileSchema.parse(hardware);
  const validModelMetadata = modelMetadataSchema.safeParse(model);
  if (!validModelMetadata.success)
    throw new Error(
      formatValidationError(
        "Invalid model definition",
        validModelMetadata.error,
      ),
    );
  validatePolicy(policy);
  if (!Array.isArray(model.quantizations)) return undefined;
  const candidates = model.quantizations
    .map((candidate, index) => ({
      candidate,
      index,
      parsed: quantizationSchema.safeParse(candidate),
    }))
    .filter((entry) => entry.parsed.success)
    .sort((a, b) => {
      const metadata = compareQuantizationMetadata(a.candidate, b.candidate);
      return metadata || a.index - b.index;
    });
  if (hardware.memoryMode === "apple-unified") {
    const results = candidates
      .map(({ candidate }) => ({
        candidate,
        result: evaluateCompatibility(
          hardware,
          { ...model, quantizations: [candidate] },
          candidate,
          policy,
          runtimeProfile,
        ),
      }))
      .filter(({ result }) => result.level !== "unsupported")
      .sort(
        (a, b) =>
          compareQuantizationMetadata(a.candidate, b.candidate) ||
          a.result.memory.estimatedSystemRamGiB -
            b.result.memory.estimatedSystemRamGiB ||
          a.candidate.id.localeCompare(b.candidate.id),
      );
    const best = results[0];
    return best
      ? { ...best.result, recommendedQuantizationId: best.candidate.id }
      : undefined;
  }
  for (const { candidate } of candidates) {
    const result = evaluateCompatibility(
      hardware,
      { ...model, quantizations: [candidate] },
      candidate,
      policy,
      runtimeProfile,
    );
    if (result.level !== "unsupported") {
      return { ...result, recommendedQuantizationId: candidate.id };
    }
  }
  return undefined;
}

function validatePolicy(policy: CompatibilityPolicy): void {
  if (
    !Number.isFinite(policy.weightOverheadMultiplier) ||
    policy.weightOverheadMultiplier <= 0 ||
    !Number.isFinite(policy.runtimeOverheadGiB) ||
    policy.runtimeOverheadGiB < 0 ||
    !Number.isFinite(policy.systemRamReserveGiB) ||
    policy.systemRamReserveGiB < 0 ||
    !Number.isFinite(policy.availableMemorySafetyMarginGiB) ||
    policy.availableMemorySafetyMarginGiB < 0 ||
    !Number.isInteger(policy.defaultContextLength) ||
    policy.defaultContextLength <= 0
  ) {
    throw new Error("Invalid compatibility policy");
  }
}

function contextGuidanceReasons(
  guidance: ContextGuidance,
): CompatibilityReason[] {
  return guidance.reasonCodes.map((code) => {
    if (code === "model-context-limit")
      return {
        code,
        severity: "info",
        message: guidance.modelMaximumContextLength
          ? `Model metadata reports a maximum context of ${guidance.modelMaximumContextLength.toLocaleString()} tokens.`
          : "Model context-limit metadata is available.",
      };
    if (code === "conservative-context-guidance")
      return {
        code,
        severity: "warning",
        message:
          "Context guidance is conservative and advisory; the separate KV-cache estimate uses only an explicit target context and supported sourced metadata.",
      };
    if (code === "context-estimation-unavailable")
      return {
        code,
        severity: "warning",
        message: guidance.message,
      };
    return {
      code,
      severity: "warning",
      message:
        "The practical context recommendation is advisory; KV-cache memory is assessed separately only when a target is supplied and cache placement is known.",
    };
  });
}

function isPositiveInteger(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value > 0;
}

function formatValidationError(
  prefix: string,
  error: { issues: { path: PropertyKey[]; message: string }[] },
): string {
  const detail = error.issues
    .map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`)
    .join("; ");
  return `${prefix}: ${detail}`;
}
