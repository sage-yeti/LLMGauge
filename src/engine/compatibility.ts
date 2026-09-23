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
  QuantizationDefinition,
} from "@/domain/types";
import { DEFAULT_COMPATIBILITY_POLICY } from "./assumptions";

export function estimateMemory(
  model: ModelDefinition,
  quantization: QuantizationDefinition,
  policy: CompatibilityPolicy = DEFAULT_COMPATIBILITY_POLICY,
) {
  validatePolicy(policy);
  const modelWeightsGiB =
    quantization.sizeGiB ??
    (model.parameterCountBillions * quantization.bitsPerWeight) / 8;
  const overhead =
    quantization.overheadMultiplier ?? policy.weightOverheadMultiplier;
  const estimatedVramGiB =
    modelWeightsGiB * overhead + policy.runtimeOverheadGiB;
  return {
    modelWeightsGiB: round(modelWeightsGiB),
    runtimeOverheadGiB: policy.runtimeOverheadGiB,
    estimatedVramGiB: round(estimatedVramGiB),
    estimatedSystemRamGiB: round(estimatedVramGiB + policy.systemRamReserveGiB),
  };
}

export function evaluateCompatibility(
  hardware: HardwareProfile,
  model: ModelDefinition,
  quantization: QuantizationDefinition,
  policy: CompatibilityPolicy = DEFAULT_COMPATIBILITY_POLICY,
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
  const memory = estimateMemory(model, quantization, policy);
  const vram = hardware.gpu?.vramGiB ?? 0;
  const vramCanHoldModel =
    vram >= memory.estimatedVramGiB + policy.availableMemorySafetyMarginGiB;
  const ramCanHoldModel =
    hardware.systemRamGiB >=
    memory.estimatedSystemRamGiB + policy.availableMemorySafetyMarginGiB;
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
  const contextGuidance = buildContextGuidance(model, policy);
  reasons.push(...contextGuidanceReasons(contextGuidance));
  if (policy.availableMemorySafetyMarginGiB > 0)
    reasons.push({
      code: "safety-margin",
      severity: "warning",
      message: `A conservative ${policy.availableMemorySafetyMarginGiB} GiB safety margin is included in the fit check.`,
    });
  if (vramCanHoldModel && ramCanHoldModel) {
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
  if (!hardware.gpu)
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
    vram === memory.estimatedVramGiB ||
    hardware.systemRamGiB === memory.estimatedSystemRamGiB
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
        reason.code === "integrated-shared-memory",
    )
    .map((reason) => reason.message);
  return {
    modelId: model.id,
    quantizationId: quantization.id,
    level,
    executionMode,
    memory,
    recommendedQuantizationId: null,
    contextGuidance,
    limitingFactors,
    messages: [
      `${model.displayName} (${quantization.displayName}) is classified as ${level}.`,
    ],
    reasons,
    assumptions: { ...policy },
    warnings,
  };
}

/**
 * Produces advisory context guidance without changing memory estimates or
 * compatibility classification. KV-cache size and runtime-specific context
 * costs are intentionally not modeled here.
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
        "No KV-cache size or runtime-specific context memory is estimated.",
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
      "KV-cache size, runtime settings, and context-related performance are not estimated.",
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
      const precision = b.candidate.bitsPerWeight - a.candidate.bitsPerWeight;
      return precision || a.index - b.index;
    });
  for (const { candidate } of candidates) {
    const result = evaluateCompatibility(
      hardware,
      { ...model, quantizations: [candidate] },
      candidate,
      policy,
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
          "Context guidance is conservative and advisory; it does not calculate KV-cache memory.",
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
        "Context memory is an approximate, runtime-dependent assumption and is not included in the compatibility classification.",
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

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
