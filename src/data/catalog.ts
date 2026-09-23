import { gpuDefinitionSchema, modelDefinitionSchema } from "@/domain/schemas";
import type { GpuDefinition, ModelDefinition } from "@/domain/types";
import { productionGpus, productionModels } from "./production-catalog";

/** Small curated production registry; this is intentionally not exhaustive. */
export const modelCatalog: readonly ModelDefinition[] = productionModels;
export const gpuCatalog: readonly GpuDefinition[] = productionGpus;

export function getModelById(id: string): ModelDefinition | undefined {
  return modelCatalog.find((model) => model.id === id);
}

export function getModelBySlug(slug: string): ModelDefinition | undefined {
  return modelCatalog.find((model) => model.slug === slug);
}

export function getGpuById(id: string): GpuDefinition | undefined {
  return gpuCatalog.find((gpu) => gpu.id === id);
}

export function getGpuBySlug(slug: string): GpuDefinition | undefined {
  return gpuCatalog.find((gpu) => gpu.slug === slug);
}

export function validateCatalog(): void {
  validateCatalogEntries("model", modelCatalog, modelDefinitionSchema);
  validateCatalogEntries("GPU", gpuCatalog, gpuDefinitionSchema);
  for (const model of modelCatalog) {
    validateModelCatalogEntry(model);
    validateProductionProvenance(model.id, model.provenance.sourceType);
    for (const quantization of model.quantizations) {
      validateProductionProvenance(
        `${model.id}/${quantization.id}`,
        quantization.provenance.sourceType,
      );
    }
  }
  for (const gpu of gpuCatalog) {
    if (gpu.kind === "integrated" && gpu.vramGiB !== 0)
      throw new Error(
        `Integrated GPU ${gpu.id} must have zero dedicated VRAM.`,
      );
    validateProductionProvenance(gpu.id, gpu.provenance.sourceType);
  }
}

function validateProductionProvenance(id: string, sourceType: string): void {
  if (sourceType === "curated-estimate")
    throw new Error(`Production catalog entry ${id} cannot be a fixture.`);
}

export function validateCatalogEntries<T extends { id: string }>(
  label: string,
  entries: readonly T[],
  schema: {
    safeParse: (value: unknown) => {
      success: boolean;
      error?: { issues: { path: PropertyKey[]; message: string }[] };
    };
  },
): void {
  const ids = new Set<string>();
  const slugs = new Set<string>();
  for (const entry of entries) {
    const parsed = schema.safeParse(entry);
    if (!parsed.success)
      throw new Error(
        `Invalid ${label} catalog entry: ${formatIssues(parsed.error?.issues ?? [])}`,
      );
    if (ids.has(entry.id))
      throw new Error(`Duplicate ${label} catalog ID: ${entry.id}`);
    const entrySlug =
      "slug" in entry && typeof entry.slug === "string"
        ? entry.slug
        : undefined;
    if (entrySlug && slugs.has(entrySlug))
      throw new Error(`Duplicate ${label} catalog slug: ${entrySlug}`);
    ids.add(entry.id);
    if (entrySlug) slugs.add(entrySlug);
  }
}

export function validateUniqueQuantizationIds(model: ModelDefinition): void {
  const ids = new Set<string>();
  for (const quantization of model.quantizations) {
    if (ids.has(quantization.id))
      throw new Error(
        `Duplicate quantization ID in model ${model.id}: ${quantization.id}`,
      );
    if (quantization.bitsPerWeight <= 0 || quantization.bitsPerWeight > 16)
      throw new Error(
        `Quantization ${model.id}/${quantization.id} has an invalid bit width.`,
      );
    ids.add(quantization.id);
  }
}

export function validateModelCatalogEntry(model: ModelDefinition): void {
  if (
    model.defaultContextLength === undefined ||
    model.maxContextLength === undefined
  )
    throw new Error(
      `Model ${model.id} must include default and maximum context metadata.`,
    );
  if (model.maxContextLength < model.defaultContextLength)
    throw new Error(
      `Model ${model.id} has a maximum context below its default context.`,
    );
  validateUniqueQuantizationIds(model);
}

function formatIssues(
  issues: { path: PropertyKey[]; message: string }[],
): string {
  return issues
    .map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`)
    .join("; ");
}

// Validate the curated seed catalog during imports as well as in tests/builds.
validateCatalog();
