import Link from "next/link";
import type { GuideDefinition } from "@/data/guides";
import { getGuideBySlug } from "@/data/guides";

export function GuidePage({ guide }: { guide: GuideDefinition }) {
  const relatedGuides = guide.relatedGuideSlugs
    .map((slug) => getGuideBySlug(slug))
    .filter((related): related is GuideDefinition => related !== undefined);

  return (
    <main className="shell public-page guide-page">
      <nav className="page-nav" aria-label="Guide navigation">
        <Link href="/">Calculator</Link>
        <Link href="/recommendations">Recommendations</Link>
        <Link href="/guides">Guides</Link>
      </nav>

      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/guides">Guides</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{guide.title}</span>
      </nav>

      <header className="catalog-hero guide-hero">
        <p className="eyebrow">{guide.category}</p>
        <h1>{guide.title}</h1>
        <p className="lede">{guide.summary}</p>
        <p className="provenance-note">Last reviewed {guide.lastReviewed}.</p>
      </header>

      <article className="guide-content">
        {guide.sections.map((section) => (
          <section className="guide-section" key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.bullets && (
              <ul>
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>

      <section className="guide-card" aria-labelledby="guide-actions">
        <h2 id="guide-actions">Continue with LLMGauge</h2>
        <div className="guide-link-list">
          {guide.relatedLinks.map((link) => (
            <Link className="action-link" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="guide-card" aria-labelledby="guide-references">
        <h2 id="guide-references">References</h2>
        <ul className="reference-list">
          {guide.references.map((reference) => (
            <li key={reference.url}>
              <a href={reference.url} target="_blank" rel="noreferrer">
                {reference.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="provenance-note">
          These references support the concepts explained here. LLMGauge
          simplifies them for planning and does not present the guides as
          runtime documentation or performance benchmarks.
        </p>
      </section>

      <section className="guide-card" aria-labelledby="more-guides">
        <h2 id="more-guides">More guides</h2>
        <div className="guide-link-list">
          {relatedGuides.map((related) => (
            <Link
              className="secondary-link"
              href={`/guides/${related.slug}`}
              key={related.slug}
            >
              {related.title}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
