import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { modelCatalog, getModelBySlug } from "@/data/catalog";
import { ModelCatalogPage } from "@/app/catalog-page";
import { modelPageDescription } from "@/app/catalog-metadata";

type ModelPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return modelCatalog.map((model) => ({ slug: model.slug }));
}

export async function generateMetadata({
  params,
}: ModelPageProps): Promise<Metadata> {
  const { slug } = await params;
  const model = getModelBySlug(slug);
  if (!model) return {};
  const description = modelPageDescription(model);
  const path = `/models/${model.slug}`;
  return {
    title: model.displayName,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${model.displayName} · LLMGauge`,
      description,
      url: path,
      type: "article",
    },
  };
}

export default async function ModelPage({ params }: ModelPageProps) {
  const { slug } = await params;
  const model = getModelBySlug(slug);
  if (!model) notFound();
  return <ModelCatalogPage model={model} />;
}
