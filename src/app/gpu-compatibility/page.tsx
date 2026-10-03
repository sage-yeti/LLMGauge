import type { Metadata } from "next";
import { GpuCompatibility } from "../gpu-compatibility";
import { absoluteUrl } from "../site";
import { gpuCatalog, modelCatalog } from "@/data/catalog";

export const metadata: Metadata = {
  title: "Which GPUs Can Run This Model? | LLMGauge",
  description:
    "Compare catalogued discrete GPUs for one local model using an explicit system RAM value and LLMGauge's approximate compatibility estimates.",
  alternates: { canonical: absoluteUrl("/gpu-compatibility") },
  openGraph: { url: absoluteUrl("/gpu-compatibility") },
};

export default function GpuCompatibilityPage() {
  return <GpuCompatibility models={modelCatalog} gpus={gpuCatalog} />;
}
