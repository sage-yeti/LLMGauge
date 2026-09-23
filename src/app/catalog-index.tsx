import Link from "next/link";
import type { GpuDefinition, ModelDefinition } from "@/domain/types";

function formatGiB(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)} GiB`;
}

export function ModelCatalogIndex({
  models,
}: {
  models: readonly ModelDefinition[];
}) {
  return (
    <main className="shell public-page">
      <nav className="page-nav" aria-label="Catalog navigation">
        <Link href="/">Calculator</Link>
        <Link href="/recommendations">Recommendations</Link>
        <Link href="/gpus">GPU catalog</Link>
        <Link href="/guides">Guides</Link>
      </nav>
      <header className="catalog-hero">
        <p className="eyebrow">Curated model catalog</p>
        <h1>Browse local language models</h1>
        <p className="lede">
          Compare cataloged model families, parameter sizes, and recorded
          formats. Open a model for its quantization candidates, sources, and
          compatibility notes.
        </p>
      </header>
      <section className="catalog-index-grid" aria-label="Models">
        {models.length ? (
          models.map((model) => (
            <article className="catalog-index-card" key={model.slug}>
              <h2>
                <Link href={`/models/${model.slug}`}>{model.displayName}</Link>
              </h2>
              <p>{model.summary}</p>
              <dl className="catalog-index-facts">
                <div>
                  <dt>Provider</dt>
                  <dd>{model.provider}</dd>
                </div>
                <div>
                  <dt>Family</dt>
                  <dd>{model.family}</dd>
                </div>
                <div>
                  <dt>Parameters</dt>
                  <dd>{model.parameterCountBillions}B</dd>
                </div>
                <div>
                  <dt>Formats</dt>
                  <dd>{model.supportedFormats.join(", ") || "Not recorded"}</dd>
                </div>
              </dl>
            </article>
          ))
        ) : (
          <p className="catalog-index-empty">No models are currently listed.</p>
        )}
      </section>
    </main>
  );
}

export function GpuCatalogIndex({ gpus }: { gpus: readonly GpuDefinition[] }) {
  return (
    <main className="shell public-page">
      <nav className="page-nav" aria-label="Catalog navigation">
        <Link href="/">Calculator</Link>
        <Link href="/recommendations">Recommendations</Link>
        <Link href="/models">Model catalog</Link>
        <Link href="/guides">Guides</Link>
      </nav>
      <header className="catalog-hero">
        <p className="eyebrow">Curated GPU catalog</p>
        <h1>Browse graphics hardware</h1>
        <p className="lede">
          Compare the catalog’s dedicated memory capacities and documented
          hardware details. Open a GPU for its source and planning notes.
        </p>
      </header>
      <section className="catalog-index-grid" aria-label="Graphics hardware">
        {gpus.length ? (
          gpus.map((gpu) => (
            <article className="catalog-index-card" key={gpu.slug}>
              <h2>
                <Link href={`/gpus/${gpu.slug}`}>{gpu.displayName}</Link>
              </h2>
              <p>{gpu.suitabilitySummary}</p>
              <dl className="catalog-index-facts">
                <div>
                  <dt>Vendor</dt>
                  <dd>{gpu.vendor}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>
                    {gpu.kind === "integrated" ? "Integrated" : "Discrete"}
                  </dd>
                </div>
                <div>
                  <dt>Dedicated VRAM</dt>
                  <dd>
                    {gpu.kind === "integrated"
                      ? "0 GiB (integrated)"
                      : formatGiB(gpu.vramGiB)}
                  </dd>
                </div>
                {gpu.memoryType && (
                  <div>
                    <dt>Memory type</dt>
                    <dd>{gpu.memoryType}</dd>
                  </div>
                )}
                {gpu.architecture && (
                  <div>
                    <dt>Architecture</dt>
                    <dd>{gpu.architecture}</dd>
                  </div>
                )}
              </dl>
            </article>
          ))
        ) : (
          <p className="catalog-index-empty">No GPUs are currently listed.</p>
        )}
      </section>
    </main>
  );
}
