import type { Metadata } from "next";
import Link from "next/link";
import { guideCatalog } from "@/data/guides";

export const metadata: Metadata = {
  title: "Local LLM Guides",
  description:
    "Plain-language guides to VRAM, quantization, GPU offloading, context length, and LLMGauge compatibility estimates.",
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "Local LLM Guides · LLMGauge",
    description:
      "Plain-language guides to the concepts behind local LLM compatibility estimates.",
    url: "/guides",
    type: "website",
  },
};

export default function GuidesIndexPage() {
  return (
    <main className="shell public-page guide-page">
      <nav className="page-nav" aria-label="Guide navigation">
        <Link href="/">Calculator</Link>
        <Link href="/recommendations">Recommendations</Link>
      </nav>
      <header className="catalog-hero guide-hero">
        <p className="eyebrow">LLMGauge guides</p>
        <h1>Understand local LLM compatibility</h1>
        <p className="lede">
          Short, source-aware explanations of the memory and runtime concepts
          behind the calculator.
        </p>
      </header>
      <section
        className="guide-index-list"
        aria-labelledby="guide-list-heading"
      >
        <h2 id="guide-list-heading">Explore the guides</h2>
        <div className="guide-index-grid">
          {guideCatalog.map((guide) => (
            <article className="guide-card" key={guide.slug}>
              <p className="eyebrow">{guide.category}</p>
              <h3>
                <Link href={`/guides/${guide.slug}`}>{guide.title}</Link>
              </h3>
              <p>{guide.summary}</p>
              <Link className="details-link" href={`/guides/${guide.slug}`}>
                Read this guide
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
