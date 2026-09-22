import type { GpuDefinition, ModelDefinition } from "@/domain/types";

export function modelPageDescription(model: ModelDefinition): string {
  return `${model.displayName}: ${model.summary} Review quantizations, context guidance, and approximate memory needs.`;
}

export function gpuPageDescription(gpu: GpuDefinition): string {
  const memory =
    gpu.kind === "integrated"
      ? "integrated/shared memory"
      : `${gpu.vramGiB} GiB dedicated VRAM`;
  return `${gpu.displayName} from ${gpu.vendor} with ${memory}. See conservative local LLM compatibility guidance.`;
}
