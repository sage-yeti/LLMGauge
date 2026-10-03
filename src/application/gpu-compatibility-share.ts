import { parseRuntimeProfile } from "@/application/hardware";
import type { RuntimeProfileFormValues } from "@/application/hardware";
import type { GpuCompatibilityFormValues } from "@/application/gpu-compatibility";
import { modelDefinitionSchema } from "@/domain/schemas";
import type { ModelDefinition } from "@/domain/types";
import { z } from "zod";

export const GPU_COMPARISON_SHARE_VERSION = "1";

const allowedKeys = new Set([
  "v",
  "model",
  "ram",
  "runtime",
  "backend",
  "execution",
  "context",
]);

const positiveRam = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0);

export type GpuCompatibilityShareParseResult =
  | { status: "none" }
  | { status: "invalid"; message: string }
  | { status: "valid"; values: GpuCompatibilityFormValues };

function validValues(
  values: GpuCompatibilityFormValues,
  models: readonly ModelDefinition[],
): boolean {
  const model = models.find((candidate) => candidate.id === values.modelId);
  return Boolean(
    model &&
      modelDefinitionSchema.safeParse(model).success &&
      positiveRam.safeParse(values.systemRamGiB).success &&
      Object.keys(parseRuntimeProfile(values).fieldErrors).length === 0,
  );
}

/** Build a deterministic query path containing only validated comparison inputs. */
export function buildGpuCompatibilitySharePath(
  values: GpuCompatibilityFormValues,
  models: readonly ModelDefinition[],
): string | null {
  if (!validValues(values, models)) return null;

  const params = new URLSearchParams();
  params.set("v", GPU_COMPARISON_SHARE_VERSION);
  params.set("model", values.modelId);
  params.set("ram", String(Number(values.systemRamGiB)));
  if (values.runtime) params.set("runtime", values.runtime);
  if (values.backend) params.set("backend", values.backend);
  if (values.executionPreference)
    params.set("execution", values.executionPreference);
  if (values.targetContextLength)
    params.set("context", String(Number(values.targetContextLength)));
  return `/gpu-compatibility?${params.toString()}`;
}

/** Validate the entire query before returning any values for the form. */
export function parseGpuCompatibilityShareParams(
  params: URLSearchParams,
  models: readonly ModelDefinition[],
): GpuCompatibilityShareParseResult {
  if ([...params.keys()].length === 0) return { status: "none" };

  const valuesByKey = new Map<string, string>();
  for (const [key, value] of params.entries()) {
    if (!allowedKeys.has(key) || valuesByKey.has(key)) {
      return {
        status: "invalid",
        message:
          "This comparison link contains unsupported or repeated values. Enter your comparison manually.",
      };
    }
    valuesByKey.set(key, value);
  }

  if (
    valuesByKey.get("v") !== GPU_COMPARISON_SHARE_VERSION ||
    !valuesByKey.has("model") ||
    !valuesByKey.has("ram")
  ) {
    return {
      status: "invalid",
      message:
        "This comparison link is incomplete or uses an unsupported format. Enter your comparison manually.",
    };
  }

  if (
    ["runtime", "backend", "execution", "context"].some(
      (key) => valuesByKey.has(key) && valuesByKey.get(key) === "",
    )
  ) {
    return {
      status: "invalid",
      message:
        "This comparison link contains an empty setting. Enter your comparison manually.",
    };
  }

  const candidate: GpuCompatibilityFormValues = {
    modelId: valuesByKey.get("model")!,
    systemRamGiB: valuesByKey.get("ram")!,
    runtime: (valuesByKey.get("runtime") ?? "") as RuntimeProfileFormValues["runtime"],
    backend: (valuesByKey.get("backend") ?? "") as RuntimeProfileFormValues["backend"],
    executionPreference: (valuesByKey.get("execution") ??
      "") as RuntimeProfileFormValues["executionPreference"],
    targetContextLength: valuesByKey.get("context") ?? "",
  };

  if (!validValues(candidate, models)) {
    return {
      status: "invalid",
      message:
        "This comparison link includes an unavailable model or invalid setting. Enter your comparison manually.",
    };
  }
  return { status: "valid", values: candidate };
}
