import type { CalculatorFormValues } from "@/application/calculator";
import { parseHardwareForm, parseRuntimeProfile } from "@/application/hardware";
import { modelDefinitionSchema } from "@/domain/schemas";
import type { GpuDefinition, ModelDefinition } from "@/domain/types";

export const CALCULATOR_SHARE_VERSION = "1";

export type CalculatorShareParseResult =
  | { status: "none" }
  | { status: "invalid"; message: string }
  | { status: "valid"; values: CalculatorFormValues };

const allowedKeys = new Set([
  "v",
  "model",
  "quantization",
  "cpu",
  "gpu",
  "vram",
  "ram",
  "os",
  "mode",
  "runtime",
  "backend",
  "execution",
  "context",
]);

function invalid(message: string): CalculatorShareParseResult {
  return {
    status: "invalid",
    message: `${message} Enter your values manually.`,
  };
}

function validateValues(
  values: CalculatorFormValues,
  models: readonly ModelDefinition[],
  gpus: readonly GpuDefinition[],
): boolean {
  const model = models.find((candidate) => candidate.id === values.modelId);
  if (
    !model ||
    !modelDefinitionSchema.safeParse(model).success ||
    !model.quantizations.some(
      (candidate) => candidate.id === values.quantizationId,
    ) ||
    !parseHardwareForm(values).hardware ||
    Object.keys(parseRuntimeProfile(values).fieldErrors).length > 0
  )
    return false;

  if (
    values.memoryMode !== "apple-unified" &&
    values.gpuId !== "none" &&
    !gpus.some((gpu) => gpu.id === values.gpuId)
  )
    return false;
  return true;
}

/** Build a stable URL containing only the evaluated calculator form inputs. */
export function buildCalculatorSharePath(
  values: CalculatorFormValues,
  models: readonly ModelDefinition[],
  gpus: readonly GpuDefinition[],
): string | null {
  if (!validateValues(values, models, gpus)) return null;

  const params = new URLSearchParams();
  params.set("v", CALCULATOR_SHARE_VERSION);
  params.set("model", values.modelId);
  params.set("quantization", values.quantizationId);
  params.set("cpu", values.cpuName.trim());
  params.set("ram", String(Number(values.systemRamGiB)));
  params.set(
    "os",
    values.memoryMode === "apple-unified" ? "macos" : values.operatingSystem,
  );
  if (values.memoryMode === "apple-unified")
    params.set("mode", values.memoryMode);
  if (values.memoryMode !== "apple-unified") {
    params.set("gpu", values.gpuId);
    params.set("vram", String(Number(values.vramGiB)));
  }
  if (values.runtime) params.set("runtime", values.runtime);
  if (values.backend) params.set("backend", values.backend);
  if (values.executionPreference)
    params.set("execution", values.executionPreference);
  if (values.targetContextLength)
    params.set("context", String(Number(values.targetContextLength)));
  return `/?${params.toString()}`;
}

/** Reject the full link unless every catalog and form value validates. */
export function parseCalculatorShareParams(
  params: URLSearchParams,
  models: readonly ModelDefinition[],
  gpus: readonly GpuDefinition[],
): CalculatorShareParseResult {
  if ([...params.keys()].length === 0) return { status: "none" };

  const valuesByKey = new Map<string, string>();
  for (const [key, value] of params.entries()) {
    if (!allowedKeys.has(key) || valuesByKey.has(key))
      return invalid(
        "This calculator link contains unsupported or repeated values.",
      );
    valuesByKey.set(key, value);
  }

  const apple = valuesByKey.get("mode") === "apple-unified";
  if (apple && (valuesByKey.has("gpu") || valuesByKey.has("vram")))
    return invalid(
      "This Apple unified-memory link contains inactive PC-only fields.",
    );
  const required = ["v", "model", "quantization", "cpu", "ram", "os"];
  if (!apple) required.push("gpu", "vram");
  if (
    required.some((key) => !valuesByKey.has(key)) ||
    valuesByKey.get("v") !== CALCULATOR_SHARE_VERSION
  )
    return invalid(
      "This calculator link is incomplete or uses an unsupported format.",
    );

  if (
    valuesByKey.get("cpu")?.trim() === "" ||
    [...valuesByKey].some(([key, value]) => key !== "cpu" && value === "")
  )
    return invalid("This calculator link contains an empty or invalid value.");

  const candidate: CalculatorFormValues = {
    modelId: valuesByKey.get("model")!,
    quantizationId: valuesByKey.get("quantization")!,
    cpuName: valuesByKey.get("cpu")!,
    systemRamGiB: valuesByKey.get("ram")!,
    operatingSystem: valuesByKey.get(
      "os",
    ) as CalculatorFormValues["operatingSystem"],
    gpuId: apple ? "none" : valuesByKey.get("gpu")!,
    vramGiB: apple ? "0" : valuesByKey.get("vram")!,
    ...(valuesByKey.has("mode")
      ? { memoryMode: valuesByKey.get("mode") as "pc" | "apple-unified" }
      : {}),
    runtime: (valuesByKey.get("runtime") ??
      "") as CalculatorFormValues["runtime"],
    backend: (valuesByKey.get("backend") ??
      "") as CalculatorFormValues["backend"],
    executionPreference: (valuesByKey.get("execution") ??
      "") as CalculatorFormValues["executionPreference"],
    targetContextLength: valuesByKey.get("context") ?? "",
  };

  if (!validateValues(candidate, models, gpus))
    return invalid(
      "This calculator link includes an unavailable model, quantization, GPU, or invalid setting.",
    );
  return { status: "valid", values: candidate };
}
