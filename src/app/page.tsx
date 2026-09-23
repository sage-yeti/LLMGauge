import type { Metadata } from "next";
import Link from "next/link";
import { Calculator } from "./calculator";
import { absoluteUrl } from "./site";
import { gpuCatalog, modelCatalog } from "@/data/catalog";

export const metadata: Metadata = {
  alternates: { canonical: absoluteUrl("/") },
  openGraph: { url: absoluteUrl("/") },
};

export default function HomePage() {
  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">LLMGauge · local model compatibility</p>
        <h1>Can your computer run this local LLM?</h1>
        <p className="lede">
          Choose a model, describe your hardware, and get a transparent
          first-pass compatibility assessment.
        </p>
        <nav className="page-nav" aria-label="Primary navigation">
          <Link href="/recommendations">What can my PC run?</Link>
          <Link href="/models">Browse models</Link>
          <Link href="/gpus">Browse GPUs</Link>
          <Link href="/guides">Learn the basics</Link>
        </nav>
      </header>
      <section className="workflow-choice" aria-labelledby="workflow-heading">
        <div className="section-heading">
          <p className="section-number">Start here</p>
          <div>
            <h2 id="workflow-heading">
              Choose the question you want to answer
            </h2>
            <p>
              Use the calculator for one model, or compare the catalog against
              your hardware.
            </p>
          </div>
        </div>
        <div className="workflow-grid">
          <article className="workflow-card">
            <h3>Check one specific model</h3>
            <p>
              Pick a model and quantization when you already know what you want
              to run.
            </p>
            <a href="#calculator">Use the calculator below</a>
          </article>
          <article className="workflow-card">
            <h3>Discover models for your PC</h3>
            <p>
              Enter your hardware once and receive a deterministic list of
              suitable catalog models.
            </p>
            <Link href="/recommendations">Open recommendations</Link>
          </article>
        </div>
        <p className="workflow-note">
          You will need your CPU, system RAM, GPU (if you have one), dedicated
          VRAM, and operating system. Results are approximate planning guidance,
          not performance guarantees.
        </p>
      </section>
      <div id="calculator">
        <Calculator models={modelCatalog} gpus={gpuCatalog} />
      </div>
      <p className="page-note">
        Estimates are approximate memory guidance, not performance benchmarks or
        guarantees.
      </p>
    </main>
  );
}
