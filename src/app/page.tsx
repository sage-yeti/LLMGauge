import { Calculator } from "./calculator";
import { gpuCatalog, modelCatalog } from "@/data/catalog";

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
        </nav>
      </header>
      <Calculator models={modelCatalog} gpus={gpuCatalog} />
      <p className="page-note">
        Estimates are approximate memory guidance, not performance benchmarks or
        guarantees.
      </p>
    </main>
  );
}
import Link from "next/link";
