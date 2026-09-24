import type { Metadata } from "next";
import { ModelCatalogIndex } from "@/app/catalog-index";
import { modelCatalog } from "@/data/catalog";
import { absoluteUrl } from "@/app/site";

const path = "/models";
const title = "Browse Local LLM Models";
const description =
  "Browse LLMGauge’s curated local model catalog by provider, family, and parameter size. Open each model for quantizations, sources, and compatibility notes.";

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

export default function ModelsPage() {
  return <ModelCatalogIndex models={modelCatalog} />;
}
