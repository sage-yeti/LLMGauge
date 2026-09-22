# LLMGauge

LLMGauge is a TypeScript web foundation for evaluating whether local GGUF/llama.cpp-compatible language models can run on a user’s hardware.

## Development

```bash
npm install
npm run dev       # development server
npm run test      # unit tests
npm run lint      # ESLint
npm run typecheck # TypeScript
npm run format    # Prettier check
npm run build     # production build
npm start         # production server/smoke check after build
```

## Current calculator flow

The home route now contains the first compatibility calculator. Select the representative model and quantization, enter a CPU and system RAM amount, optionally select a fixture GPU, and submit the form. The UI passes the validated values through `src/application/calculator.ts`, which resolves registry IDs and calls the framework-independent compatibility engine. It does not calculate memory or classify results in React.

The `/recommendations` route implements the second core workflow: “What can my PC run?”. It reuses the shared hardware controls and `parseHardwareForm` boundary, evaluates every valid catalog quantization through the same compatibility engine, and returns one deterministic representative per model. Usable results are ranked ahead of unsupported results using this policy: compatibility level first (`GPU-capable`, `partial-offload`, `CPU-only`, then `unsupported`), higher bits-per-weight next, lower estimated VRAM next, then stable model and quantization IDs. Unsupported representatives are kept in a separate expandable section rather than mixed into the default recommendations.

Results currently show GPU-capable, partial-offload, CPU-only, or unsupported classifications, approximate VRAM/RAM estimates, quantization recommendations, limiting factors, context guidance, and the assumptions/warnings used by the engine. The estimates are not performance benchmarks or guarantees. The current fixture catalog is intentionally tiny; model ranking, hardware detection, public catalog pages, accounts, and backend/API features are not implemented yet.

## Architecture

- `src/app/`: Next.js App Router and presentation code. Future server-rendered/static routes such as `/models/[id]`, `/gpus/[id]`, and `/guides/[slug]` belong here.
- `src/domain/`: framework-independent types and Zod runtime schemas.
- `src/engine/`: deterministic compatibility calculations and named policies. This layer has no Next.js, UI, network, or AI dependencies and is directly unit-tested.
- `src/data/`: small fixtures and registry helpers. `catalog.ts` is the access boundary for future model/GPU catalog growth; it is intentionally not a full catalog yet.

## Domain contract, provenance, and units

All memory values crossing the domain and engine boundary are expressed in GiB. IDs are stable machine-facing identifiers; display names and summaries are presentation metadata. Models and GPUs also have URL-safe stable slugs, so future `/models/[slug]` and `/gpus/[slug]` pages will not depend on UI object shapes. Dedicated GPU memory is `vramGiB`. Integrated GPUs may report zero dedicated VRAM and optional `sharedMemoryGiB`, which is deliberately not counted as dedicated VRAM by the first engine pass.

Catalog entries carry small provenance records (`source`, confidence, ISO `lastVerified` date, and optional notes). The current seed values are curated approximate fixtures, not authoritative hardware specifications. Schemas reject malformed slugs, dates, provenance, negative memory, and zero system RAM; catalog validation additionally checks duplicate IDs/slugs, duplicate quantization IDs, context ranges, integrated-GPU VRAM, and valid embedded quantization entries. Use `getModelById`/`getModelBySlug` and their GPU equivalents as the registry boundary.

## Initial calculation assumptions

The first engine pass estimates raw weights as `parameters × bits-per-weight ÷ 8`, applies a configurable 12% overhead multiplier, and adds 0.75 GiB runtime overhead. Estimated system RAM includes a 2 GiB reserved-system-memory allowance. An optional safety margin can be supplied through the compatibility policy. These are deliberately transparent, approximate heuristics—not benchmark results. Context length, backend, GPU architecture, KV-cache size, operating-system usage, and runtime settings can materially change real requirements.

The engine currently chooses the highest-bits-per-weight candidate that fits the supplied hardware, preserving model input order for ties. It distinguishes dedicated-GPU fit, partial offload, CPU-only, and unsupported results. Each result includes typed reason codes such as `insufficient-vram`, `insufficient-system-ram`, `integrated-shared-memory`, `exact-memory-boundary`, and `approximate-estimate`; the UI formats the associated messages without recreating the decision logic. Integrated/shared-memory handling is intentionally conservative, and no result promises a tokens-per-second rate.

## SEO/page architecture

The App Router and server-first page structure leave room for crawlable model, GPU, and guide routes with metadata and static generation later. This batch adds no catalog pages, mass-generated content, scraping, authentication, advertising, or database.
