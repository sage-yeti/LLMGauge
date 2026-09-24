import type { Metadata } from "next";
import { GpuCatalogIndex } from "@/app/catalog-index";
import { gpuCatalog } from "@/data/catalog";
import { absoluteUrl } from "@/app/site";

const path = "/gpus";
const title = "Browse GPU Memory Profiles";
const description =
  "Browse LLMGauge’s curated GPU catalog by vendor, type, and documented dedicated memory. Open each profile for its source and compatibility notes.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl(path) },
  openGraph: {
    title: `${title} · LLMGauge`,
    description,
    url: absoluteUrl(path),
  },
};

export default function GpusPage() {
  return <GpuCatalogIndex gpus={gpuCatalog} />;
}
