import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { gpuCatalog, getGpuBySlug } from "@/data/catalog";
import { GpuCatalogPage } from "@/app/catalog-page";
import { gpuPageDescription } from "@/app/catalog-metadata";

type GpuPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return gpuCatalog.map((gpu) => ({ slug: gpu.slug }));
}

export async function generateMetadata({
  params,
}: GpuPageProps): Promise<Metadata> {
  const { slug } = await params;
  const gpu = getGpuBySlug(slug);
  if (!gpu) return {};
  const description = gpuPageDescription(gpu);
  const path = `/gpus/${gpu.slug}`;
  return {
    title: gpu.displayName,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${gpu.displayName} · LLMGauge`,
      description,
      url: path,
      type: "article",
    },
  };
}

export default async function GpuPage({ params }: GpuPageProps) {
  const { slug } = await params;
  const gpu = getGpuBySlug(slug);
  if (!gpu) notFound();
  return <GpuCatalogPage gpu={gpu} />;
}
