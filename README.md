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

Results currently show GPU-capable, partial-offload, CPU-only, or unsupported classifications, approximate VRAM/RAM estimates, quantization recommendations, limiting factors, context guidance, and the assumptions/warnings used by the engine. The estimates are not performance benchmarks or guarantees. The current fixture catalog is intentionally tiny; model ranking, hardware detection, accounts, and backend/API features are not implemented yet.

## Public catalog pages and SEO

Curated entries are available as useful server-rendered pages at `/models/[slug]` and `/gpus/[slug]`. Their slugs, summaries, metadata, provenance, and quantization details come from `src/data/catalog.ts`; route components do not duplicate catalog records. Unknown slugs return a normal 404. The App Router also generates `/sitemap.xml` for the home, recommendations, and real catalog pages, plus `/robots.txt` pointing crawlers at that sitemap.

Set `NEXT_PUBLIC_SITE_URL` to the deployed origin before publishing so canonical URLs and sitemap entries use the public host. Local development falls back to `http://localhost:3000`. Titles and descriptions are derived from catalog fields and are intentionally concise; no benchmark, rating, or compatibility guarantee is implied.

To add a public entry, add a validated curated model or GPU record with a stable URL-safe slug, useful summary, provenance, and freshness date, then run the catalog tests and full validation commands. The project deliberately avoids mass-generated thin pages, scraping, and placeholder catalog records. To inspect pages locally, run `npm run build && npm start`, then open a real slug such as `/models/example-7b-instruct` or `/gpus/example-12gb-gpu`.

## Architecture

- `src/app/`: Next.js App Router and presentation code, including server-rendered `/models/[slug]` and `/gpus/[slug]` catalog pages plus sitemap/robots handlers. Future guide routes belong here.
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

Public catalog pages use static params from the small curated registry and metadata/canonical paths derived from each entry. They explain approximate memory and provenance, then link to hardware-specific calculators rather than calculating anonymous compatibility at build time. The project intentionally has no mass-generated content, scraping, authentication, advertising, or database.
