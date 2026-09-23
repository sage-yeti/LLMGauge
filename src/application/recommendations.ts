import { modelDefinitionSchema } from "@/domain/schemas";
import type {
  CompatibilityLevel,
  CompatibilityResult,
  HardwareProfile,
  ModelDefinition,
  QuantizationDefinition,
  RuntimeProfile,
} from "@/domain/types";
import { evaluateCompatibility } from "@/engine/compatibility";

export interface RecommendationEntry {
  model: ModelDefinition;
  quantization: QuantizationDefinition;
  result: CompatibilityResult;
  explanation: string;
}

export interface RecommendationSet {
  recommendations: RecommendationEntry[];
  unsuitable: RecommendationEntry[];
  skippedModelIds: string[];
}

const levelPriority: Record<CompatibilityLevel, number> = {
  "gpu-capable": 3,
  "partial-offload": 2,
  "cpu-only": 1,
  unsupported: 0,
};

/**
 * Selects one representative quantization per model, then ranks those entries.
 * Usable results are returned first; unsupported results remain separately available.
 */
export function recommendModels(
  hardware: HardwareProfile,
  models: readonly ModelDefinition[],
  runtimeProfile?: RuntimeProfile,
): RecommendationSet {
  const validEntries: RecommendationEntry[] = [];
  const skippedModelIds: string[] = [];
  const seenModelIds = new Set<string>();

  for (const model of models) {
    if (seenModelIds.has(model.id)) {
      skippedModelIds.push(model.id);
      continue;
    }
    seenModelIds.add(model.id);
    if (
      !modelDefinitionSchema.safeParse(model).success ||
      model.quantizations.length === 0
    ) {
      skippedModelIds.push(model.id);
      continue;
    }
    for (const quantization of model.quantizations) {
      try {
        const result = evaluateCompatibility(
          hardware,
          model,
          quantization,
          undefined,
          runtimeProfile,
        );
        validEntries.push({
          model,
          quantization,
          result,
          explanation: makeExplanation(result),
        });
      } catch {
        // Invalid quantization candidates are ignored while valid catalog entries remain useful.
      }
    }
  }

  const representatives = [
    ...new Map(validEntries.map((entry) => [entry.model.id, entry])).values(),
  ];
  for (const entry of validEntries) {
    const current = representatives.find(
      (candidate) => candidate.model.id === entry.model.id,
    );
    if (current && compareEntries(entry, current) < 0) {
      representatives[representatives.indexOf(current)] = entry;
    }
  }

  const sorted = representatives.sort(compareEntries);
  return {
    recommendations: sorted.filter(
      (entry) => entry.result.level !== "unsupported",
    ),
    unsuitable: sorted.filter((entry) => entry.result.level === "unsupported"),
    skippedModelIds,
  };
}

function compareEntries(
  a: RecommendationEntry,
  b: RecommendationEntry,
): number {
  const levelDifference =
    levelPriority[b.result.level] - levelPriority[a.result.level];
  if (levelDifference) return levelDifference;
  const qualityDifference =
    b.quantization.bitsPerWeight - a.quantization.bitsPerWeight;
  if (qualityDifference) return qualityDifference;
  const memoryDifference =
    a.result.memory.estimatedVramGiB - b.result.memory.estimatedVramGiB;
  if (memoryDifference) return memoryDifference;
  const modelDifference = a.model.id.localeCompare(b.model.id);
  return modelDifference || a.quantization.id.localeCompare(b.quantization.id);
}

function makeExplanation(result: CompatibilityResult): string {
  if (result.level === "gpu-capable")
    return "Fits within the estimated dedicated VRAM and system RAM requirements.";
  if (result.level === "partial-offload")
    return "System RAM is sufficient, but some model layers would need to use it because dedicated VRAM is limited.";
  if (result.level === "cpu-only")
    return "The model fits the estimated system RAM, but no dedicated GPU execution is available.";
  return "The estimated memory requirement exceeds the available hardware memory.";
}
