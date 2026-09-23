import { z } from "zod";
import type {
  GpuDefinition,
  HardwareProfile,
  ModelDefinition,
  QuantizationDefinition,
  RuntimeProfile,
} from "./types";

const nonNegative = z.number().finite().nonnegative();
const positive = z.number().finite().positive();
const slug = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase URL-safe words separated by hyphens.",
  );
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO date in YYYY-MM-DD format.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: "Use a real calendar date.",
  });
const provenanceSchema = z.object({
  source: z.string().trim().min(1),
  sourceUrl: z
    .string()
    .url()
    .refine((value) => value.startsWith("https://"), {
      message: "Source URLs must use HTTPS.",
    }),
  sourceType: z.enum([
    "official-model-card",
    "official-documentation",
    "manufacturer-specification",
    "community-conversion",
    "project-documentation",
    "curated-estimate",
  ]),
  confidence: z.enum(["verified", "approximate"]),
  lastVerified: isoDate,
  note: z.string().trim().min(1).optional(),
});

export const hardwareProfileSchema: z.ZodType<HardwareProfile> = z.object({
  cpu: z.object({
    name: z.string().min(1),
    physicalCores: positive.optional(),
  }),
  gpu: z
    .object({
      id: z.string().min(1),
      name: z.string().min(1),
      kind: z.enum(["discrete", "integrated"]),
      vramGiB: nonNegative,
      sharedMemoryGiB: nonNegative.optional(),
    })
    .optional(),
  systemRamGiB: positive,
  operatingSystem: z.enum(["windows", "linux", "macos", "other"]),
});

export const runtimeProfileSchema: z.ZodType<RuntimeProfile> = z.object({
  runtime: z.enum(["llama.cpp", "unknown"]).optional(),
  backend: z.enum(["cpu", "cuda", "vulkan", "metal", "unknown"]).optional(),
  executionPreference: z
    .enum(["automatic", "full-gpu", "partial-offload", "cpu"])
    .optional(),
  targetContextLength: z.number().int().positive().optional(),
});

export const quantizationSchema: z.ZodType<QuantizationDefinition> = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  bitsPerWeight: z.number().finite().positive().max(16),
  sizeGiB: positive.optional(),
  overheadMultiplier: z.number().finite().positive().optional(),
  description: z.string().trim().min(1).optional(),
  provenance: provenanceSchema,
});

export const modelDefinitionSchema: z.ZodType<ModelDefinition> = z.object({
  id: z.string().min(1),
  slug,
  displayName: z.string().min(1),
  summary: z.string().trim().min(1),
  family: z.string().min(1),
  provider: z.string().min(1),
  architecture: z.string().trim().min(1),
  parameterCountBillions: z.number().finite().positive(),
  supportedFormats: z.array(z.enum(["gguf", "safetensors", "other"])).min(1),
  supportedRuntimes: z.array(z.enum(["llama.cpp", "ollama", "other"])).min(1),
  license: z.string().trim().min(1).optional(),
  defaultContextLength: z.number().int().positive().optional(),
  maxContextLength: z.number().int().positive().optional(),
  quantizations: z.array(quantizationSchema),
  provenance: provenanceSchema,
});

export const modelMetadataSchema: z.ZodType<
  Omit<ModelDefinition, "quantizations">
> = z.object({
  id: z.string().min(1),
  slug,
  displayName: z.string().min(1),
  summary: z.string().trim().min(1),
  family: z.string().min(1),
  provider: z.string().min(1),
  architecture: z.string().trim().min(1),
  parameterCountBillions: z.number().finite().positive(),
  supportedFormats: z.array(z.enum(["gguf", "safetensors", "other"])).min(1),
  supportedRuntimes: z.array(z.enum(["llama.cpp", "ollama", "other"])).min(1),
  license: z.string().trim().min(1).optional(),
  defaultContextLength: z.number().int().positive().optional(),
  maxContextLength: z.number().int().positive().optional(),
  provenance: provenanceSchema,
});

export const gpuDefinitionSchema: z.ZodType<GpuDefinition> = z.object({
  id: z.string().min(1),
  slug,
  displayName: z.string().min(1),
  kind: z.enum(["discrete", "integrated"]),
  vendor: z.string().trim().min(1),
  architecture: z.string().trim().min(1).optional(),
  vramGiB: nonNegative,
  memoryType: z.string().trim().min(1).optional(),
  sharedMemoryGiB: nonNegative.optional(),
  suitabilitySummary: z.string().trim().min(1),
  provenance: provenanceSchema,
});
