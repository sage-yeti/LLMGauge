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
    contextLengthGuidance: `Initial guidance: use a context length around ${policy.defaultContextLength.toLocaleString()} tokens; larger contexts require additional memory.`,
    limitingFactors,
    messages: [
      `${model.displayName} (${quantization.displayName}) is classified as ${level}.`,
    ],
    reasons,
    assumptions: { ...policy },
    warnings,
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
