import {
  parseHardwareForm,
  parseRuntimeProfile,
  type HardwareFormValues,
  type RuntimeProfileFormValues,
} from "@/application/hardware";
import type { GpuDefinition } from "@/domain/types";
import { z } from "zod";

export const RECOMMENDATIONS_SHARE_VERSION = "1";

export type RecommendationsFormValues = HardwareFormValues &
  RuntimeProfileFormValues;

export type RecommendationsShareParseResult =
  | { status: "none" }
  | { status: "invalid"; message: string }
  | { status: "valid"; values: RecommendationsFormValues };

const allowedKeys = new Set([
  "v",
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
const positive = z.string().trim().min(1).refine(isPositiveNumber);
const nonNegative = z.string().trim().min(1).refine(isNonNegativeNumber);

function validationMessage(message: string): RecommendationsShareParseResult {
  return {
    status: "invalid",
    message: `${message} Enter your hardware manually.`,
  };
}

function validateValues(
  values: RecommendationsFormValues,
  gpus: readonly GpuDefinition[],
): boolean {
  if (
    !positive.safeParse(values.systemRamGiB).success ||
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

/** Build a stable recommendations URL from the validated, applied form values. */
export function buildRecommendationsSharePath(
  values: RecommendationsFormValues,
  gpus: readonly GpuDefinition[],
): string | null {
  if (!validateValues(values, gpus)) return null;

  const params = new URLSearchParams();
  params.set("v", RECOMMENDATIONS_SHARE_VERSION);
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
  return `/recommendations?${params.toString()}`;
}

/** Validate every query value before returning state that a form can apply. */
export function parseRecommendationsShareParams(
  params: URLSearchParams,
  gpus: readonly GpuDefinition[],
): RecommendationsShareParseResult {
  if ([...params.keys()].length === 0) return { status: "none" };

  const valuesByKey = new Map<string, string>();
  for (const [key, value] of params.entries()) {
    if (!allowedKeys.has(key) || valuesByKey.has(key))
      return validationMessage(
        "This recommendations link contains unsupported or repeated values.",
      );
    valuesByKey.set(key, value);
  }

  const apple = valuesByKey.get("mode") === "apple-unified";
  if (apple && (valuesByKey.has("gpu") || valuesByKey.has("vram")))
    return validationMessage(
      "This Apple unified-memory link contains inactive PC-only fields.",
    );
  const required = ["v", "cpu", "ram", "os"];
  if (!apple) required.push("gpu", "vram");
  if (
    required.some((key) => !valuesByKey.has(key)) ||
    valuesByKey.get("v") !== RECOMMENDATIONS_SHARE_VERSION
  )
    return validationMessage(
      "This recommendations link is incomplete or uses an unsupported format.",
    );

  if (
    valuesByKey.get("cpu")?.trim() === "" ||
    !positive.safeParse(valuesByKey.get("ram")).success ||
    (!apple && !nonNegative.safeParse(valuesByKey.get("vram")).success) ||
    [...valuesByKey].some(([key, value]) => key !== "cpu" && value === "")
  )
    return validationMessage(
      "This recommendations link contains an invalid value.",
    );

  const candidate: RecommendationsFormValues = {
    cpuName: valuesByKey.get("cpu")!,
    systemRamGiB: valuesByKey.get("ram")!,
    operatingSystem: valuesByKey.get(
      "os",
    ) as RecommendationsFormValues["operatingSystem"],
    gpuId: apple ? "none" : valuesByKey.get("gpu")!,
    vramGiB: apple ? "0" : valuesByKey.get("vram")!,
    ...(valuesByKey.has("mode")
      ? { memoryMode: valuesByKey.get("mode") as "pc" | "apple-unified" }
      : {}),
    runtime: (valuesByKey.get("runtime") ??
      "") as RecommendationsFormValues["runtime"],
    backend: (valuesByKey.get("backend") ??
      "") as RecommendationsFormValues["backend"],
    executionPreference: (valuesByKey.get("execution") ??
      "") as RecommendationsFormValues["executionPreference"],
    targetContextLength: valuesByKey.get("context") ?? "",
  };

  if (!validateValues(candidate, gpus))
    return validationMessage(
      "This recommendations link includes an unavailable GPU or invalid setting.",
    );
  return { status: "valid", values: candidate };
}

function isPositiveNumber(value: string): boolean {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function isNonNegativeNumber(value: string): boolean {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}
