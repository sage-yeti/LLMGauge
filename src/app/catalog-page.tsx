import Link from "next/link";
import type { GpuDefinition, ModelDefinition } from "@/domain/types";

function formatGiB(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)} GiB`;
}

function provenanceText(
  source: string,
  confidence: string,
  lastVerified: string,
) {
  return `${source}; ${confidence} value, last verified ${lastVerified}.`;
}

export function ModelCatalogPage({ model }: { model: ModelDefinition }) {
  return (
    <main className="shell public-page">
      <nav className="page-nav" aria-label="Catalog navigation">
        <Link href="/">Calculator</Link>
        <Link href="/recommendations">Recommendations</Link>
      </nav>
      <header className="catalog-hero">
        <p className="eyebrow">Model catalog</p>
        <h1>{model.displayName}</h1>
        <p className="lede">{model.summary}</p>
        <div className="page-actions">
          <Link className="action-link" href="/">
            Check this model on your hardware
          </Link>
          <Link className="secondary-link" href="/recommendations">
            See what your PC can run
          </Link>
        </div>
      </header>

      <section className="catalog-card" aria-labelledby="model-overview">
        <h2 id="model-overview">Model overview</h2>
        <dl className="metadata-grid">
          <div>
            <dt>Family</dt>
            <dd>{model.family}</dd>
          </div>
          <div>
            <dt>Provider</dt>
            <dd>{model.provider}</dd>
          </div>
          <div>
            <dt>Architecture</dt>
            <dd>{model.architecture}</dd>
          </div>
          <div>
            <dt>Parameters</dt>
            <dd>{model.parameterCountBillions}B</dd>
          </div>
          <div>
            <dt>Formats</dt>
            <dd>{model.supportedFormats.join(", ")}</dd>
          </div>
          <div>
            <dt>Runtimes</dt>
            <dd>{model.supportedRuntimes.join(", ")}</dd>
          </div>
          <div>
            <dt>Default context</dt>
            <dd>{model.defaultContextLength.toLocaleString()} tokens</dd>
          </div>
          <div>
            <dt>Maximum context</dt>
            <dd>{model.maxContextLength.toLocaleString()} tokens</dd>
          </div>
        </dl>
      </section>

      <section className="catalog-card" aria-labelledby="quantizations">
        <h2 id="quantizations">Available quantizations</h2>
        <p className="catalog-copy">
          Lower-bit quantizations generally use less memory. The compatibility
          calculator uses these candidates and its transparent approximate
          memory assumptions; it does not make a performance guarantee.
        </p>
        <div className="quantization-list">
          {model.quantizations.map((quantization) => (
            <article className="quantization-item" key={quantization.id}>
              <div>
                <h3>{quantization.displayName}</h3>
                <p>
                  {quantization.description ??
                    "No additional quality guidance is recorded."}
                </p>
              </div>
              <dl>
                <div>
                  <dt>Bits per weight</dt>
                  <dd>{quantization.bitsPerWeight}</dd>
                </div>
                {quantization.sizeGiB !== undefined && (
                  <div>
                    <dt>Model size</dt>
                    <dd>{formatGiB(quantization.sizeGiB)}</dd>
                  </div>
                )}
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="catalog-card" aria-labelledby="model-limitations">
        <h2 id="model-limitations">Compatibility notes</h2>
        <p className="catalog-copy">
          Weight estimates are approximate and include a runtime overhead. Real
          requirements vary with context length, runtime, drivers, and other
          system use. A model page cannot determine compatibility without your
          hardware profile; use the calculator for that assessment.
        </p>
        <p className="provenance-note">
          {provenanceText(
            model.provenance.source,
            model.provenance.confidence,
            model.provenance.lastVerified,
          )}
          {model.provenance.note ? ` ${model.provenance.note}` : ""}
        </p>
      </section>
    </main>
  );
}

export function GpuCatalogPage({ gpu }: { gpu: GpuDefinition }) {
  const memory =
    gpu.kind === "integrated" ? "No dedicated VRAM" : formatGiB(gpu.vramGiB);

  return (
    <main className="shell public-page">
      <nav className="page-nav" aria-label="Catalog navigation">
        <Link href="/">Calculator</Link>
        <Link href="/recommendations">Recommendations</Link>
      </nav>
      <header className="catalog-hero">
        <p className="eyebrow">GPU catalog</p>
        <h1>{gpu.displayName}</h1>
        <p className="lede">{gpu.suitabilitySummary}</p>
        <div className="page-actions">
          <Link className="action-link" href="/recommendations">
            Find models for this hardware
          </Link>
          <Link className="secondary-link" href="/">
            Evaluate one model
          </Link>
        </div>
      </header>

      <section className="catalog-card" aria-labelledby="gpu-overview">
        <h2 id="gpu-overview">GPU overview</h2>
        <dl className="metadata-grid">
          <div>
            <dt>Vendor</dt>
            <dd>{gpu.vendor}</dd>
          </div>
          {gpu.architecture && (
            <div>
              <dt>Architecture</dt>
              <dd>{gpu.architecture}</dd>
            </div>
          )}
          <div>
            <dt>Type</dt>
            <dd>
              {gpu.kind === "integrated"
                ? "Integrated/shared-memory"
                : "Discrete"}
            </dd>
          </div>
          <div>
            <dt>Dedicated VRAM</dt>
            <dd>{memory}</dd>
          </div>
          {gpu.sharedMemoryGiB !== undefined && (
            <div>
              <dt>Shared memory</dt>
              <dd>
                {formatGiB(gpu.sharedMemoryGiB)} available to the fixture
                profile
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section className="catalog-card" aria-labelledby="gpu-guidance">
        <h2 id="gpu-guidance">Local LLM guidance</h2>
        <p className="catalog-copy">{gpu.suitabilitySummary}</p>
        <p className="catalog-copy">
          LLMGauge uses dedicated VRAM as the conservative GPU-capacity signal.
          Integrated/shared-memory graphics are not treated as dedicated GPU
          capacity by the current engine, so those systems may be classified as
          CPU-only even when the operating system can share RAM with graphics.
        </p>
        <p className="provenance-note">
          {provenanceText(
            gpu.provenance.source,
            gpu.provenance.confidence,
            gpu.provenance.lastVerified,
          )}
          {gpu.provenance.note ? ` ${gpu.provenance.note}` : ""}
        </p>
      </section>
    </main>
  );
}
