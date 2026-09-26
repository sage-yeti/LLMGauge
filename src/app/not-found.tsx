import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell not-found-page">
      <p className="eyebrow">404 · Page not found</p>
      <h1>This page isn’t in the catalog.</h1>
      <p className="lede">
        The address may have changed, or the page may not exist. Continue with
        one of the LLMGauge tools or browse the catalog.
      </p>
      <nav className="not-found-links" aria-label="Suggested pages">
        <Link className="action-link" href="/">
          Check a model
        </Link>
        <Link className="secondary-link" href="/recommendations">
          Find models for your PC
        </Link>
        <Link className="secondary-link" href="/models">
          Browse models
        </Link>
        <Link className="secondary-link" href="/gpus">
          Browse GPUs
        </Link>
      </nav>
    </main>
  );
}
