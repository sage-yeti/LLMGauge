import { parseRuntimeProfile } from "@/application/hardware";
import type { RuntimeProfileFormValues } from "@/application/hardware";
import { recommendModels } from "@/application/recommendations";
import type { RecommendationEntry } from "@/application/recommendations";
import { gpuDefinitionSchema, modelDefinitionSchema } from "@/domain/schemas";
import type { GpuDefinition, ModelDefinition } from "@/domain/types";
import { z } from "zod";

export interface GpuCompatibilityFormValues extends RuntimeProfileFormValues {
  modelId: string;
  systemRamGiB: string;
}

export interface GpuCompatibilityEntry extends RecommendationEntry {
  gpu: GpuDefinition;
}

export interface GpuCompatibilityGroup {
  level: RecommendationEntry["result"]["level"];
  label: string;
  entries: GpuCompatibilityEntry[];
}

export interface GpuCompatibilityEvaluation {
  fieldErrors: Record<string, string>;
  formError?: string;
  model?: ModelDefinition;
  groups?: GpuCompatibilityGroup[];
}

const positiveNumberText = z
  .string()
  .trim()
  .min(1, "Enter system RAM.")
  .refine(
    (value) => Number.isFinite(Number(value)) && Number(value) > 0,
    "Enter a number greater than 0.",
  );

const groupOrder = {
  "gpu-capable": 4,
  "partial-offload": 3,
  "cpu-only": 2,
  "unified-memory-fit": 2,
  unsupported: 1,
} as const;

const groupLabels = {
  "gpu-capable": "GPU-capable",
  "partial-offload": "Partial offload",
  "cpu-only": "CPU-only",
  "unified-memory-fit": "Unified-memory fit",
  unsupported: "Unsupported",
} as const;

/** Evaluate validated discrete GPUs through the established recommendation boundary. */
export function evaluateGpuCompatibility(
  values: GpuCompatibilityFormValues,
  models: readonly ModelDefinition[],
  gpus: readonly GpuDefinition[],
): GpuCompatibilityEvaluation {
  const model = models.find((candidate) => candidate.id === values.modelId);
  if (!model || !modelDefinitionSchema.safeParse(model).success) {
    return {
      fieldErrors: { modelId: "Choose a model from the catalog." },
      formError:
        "That model is unavailable. Choose a catalog model and try again.",
    };
  }

  const ram = positiveNumberText.safeParse(values.systemRamGiB);
  const fieldErrors: Record<string, string> = {};
  if (!ram.success) {
    fieldErrors.systemRamGiB =
      ram.error.issues[0]?.message ?? "Enter system RAM.";
  }
  const runtime = parseRuntimeProfile(values);
  Object.assign(fieldErrors, runtime.fieldErrors);
  if (Object.keys(fieldErrors).length) return { fieldErrors, model };

  const systemRamGiB = Number(ram.data);
  const entries: GpuCompatibilityEntry[] = [];
  for (const gpu of gpus) {
    if (gpu.kind !== "discrete" || !gpuDefinitionSchema.safeParse(gpu).success)
      continue;
    const recommendation = recommendModels(
      {
        gpu: {
          id: gpu.id,
          name: gpu.displayName,
          kind: "discrete",
          vramGiB: gpu.vramGiB,
        },
        systemRamGiB,
      },
      [model],
      runtime.runtimeProfile,
    );
    const representative =
      recommendation.recommendations[0] ?? recommendation.unsuitable[0];
    if (representative) entries.push({ ...representative, gpu });
  }

  entries.sort((a, b) => {
    const outcome = groupOrder[b.result.level] - groupOrder[a.result.level];
    if (outcome) return outcome;
    return (
      a.gpu.displayName.localeCompare(b.gpu.displayName, "en") ||
      a.gpu.id.localeCompare(b.gpu.id)
    );
  });

  const groups: GpuCompatibilityGroup[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last?.level === entry.result.level) {
      last.entries.push(entry);
    } else {
      groups.push({
        level: entry.result.level,
        label: groupLabels[entry.result.level],
        entries: [entry],
      });
    }
  }
  return { fieldErrors: {}, model, groups };
}
