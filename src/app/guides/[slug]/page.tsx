import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { guideCatalog, getGuideBySlug } from "@/data/guides";
import { GuidePage } from "@/app/guide-page";
import { guidePageDescription } from "@/app/guide-metadata";

type GuidePageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return guideCatalog.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return {};
  const description = guidePageDescription(guide);
  const path = `/guides/${guide.slug}`;
  return {
    title: guide.title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${guide.title} · LLMGauge`,
      description,
      url: path,
      type: "article",
      publishedTime: guide.lastReviewed,
      modifiedTime: guide.lastReviewed,
    },
  };
}

export default async function GuideRoute({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();
  return <GuidePage guide={guide} />;
}
