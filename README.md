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

The home route contains the compatibility calculator. Select one of the curated real models and a GGUF quantization candidate, enter a CPU and system RAM amount, optionally select a catalog GPU, and submit the form. The UI passes validated values through `src/application/calculator.ts`, which resolves registry IDs and calls the framework-independent compatibility engine. It does not calculate memory or classify results in React.

The `/recommendations` route implements the second core workflow: “What can my PC run?”. It reuses the shared hardware controls and `parseHardwareForm` boundary, evaluates every valid catalog quantization through the same compatibility engine, and returns one deterministic representative per model. Usable results are ranked ahead of unsupported results using this policy: compatibility level first (`GPU-capable`, `partial-offload`, `CPU-only`, then `unsupported`), higher bits-per-weight next, lower estimated VRAM next, then stable model and quantization IDs. Unsupported representatives are kept in a separate expandable section rather than mixed into the default recommendations.

Results show GPU-capable, partial-offload, CPU-only, or unsupported classifications, approximate VRAM/RAM estimates, quantization recommendations, limiting factors, context guidance, and the assumptions/warnings used by the engine. The estimates are not performance benchmarks or guarantees. Recommendations rank the small curated production catalog deterministically; model ranking, hardware detection, accounts, and backend/API features are not implemented.

## Public catalog pages and SEO

Curated real entries are available as useful server-rendered pages at `/models/[slug]` and `/gpus/[slug]`. Their slugs, summaries, metadata, provenance, source links, and quantization details come from `src/data/catalog.ts`; route components do not duplicate catalog records. Unknown slugs return a normal 404. The App Router also generates `/sitemap.xml` for the home, recommendations, real catalog pages, and educational guides, plus `/robots.txt` pointing crawlers at that sitemap.

## Educational guides

The `/guides` index and `/guides/[slug]` pages explain the concepts behind the results, including VRAM, quantization, GPU offloading, context length, and compatibility estimates. Guide content is typed local data in `src/data/guides.ts`; the reusable server-rendered template in `src/app/guide-page.tsx` handles layout, references, related links, and metadata without copying content into route files.

Each guide has a stable slug, a last-reviewed date, and the HTTPS references used for its technical claims. To add or update one, consult authoritative documentation, distinguish documented facts from simplified planning guidance, keep the explanation useful to non-experts, add relevant calculator or catalog links, and extend the guide tests. Run the full validation commands and inspect the generated page before publishing. The initial set is intentionally small: guides are curated educational pages, not mass-generated SEO content.

Set `NEXT_PUBLIC_SITE_URL` to the deployed origin before publishing so canonical URLs and sitemap entries use the public host. Local development falls back to `http://localhost:3000`. Titles and descriptions are derived from catalog fields and are intentionally concise; no benchmark, rating, or compatibility guarantee is implied.

## Production deployment

LLMGauge is a static-friendly Next.js App Router application and can be deployed to a Node-compatible hosting provider. No database, runtime API, or AI service is required. Copy `.env.example` to a local environment file for reference, and set `NEXT_PUBLIC_SITE_URL` to the canonical public HTTPS origin (for example, `https://llmgauge.example`). Production builds reject a missing, malformed, credential-bearing, or non-HTTPS value; development and tests use the localhost fallback when the variable is absent.

Run the production validation with the origin explicitly set:

```bash
NEXT_PUBLIC_SITE_URL=https://your-production-origin.example npm run build
NEXT_PUBLIC_SITE_URL=https://your-production-origin.example npm start
```

On Windows PowerShell, use `$env:NEXT_PUBLIC_SITE_URL = "https://your-production-origin.example"` before the commands. After deployment, verify the page source for an absolute canonical link and Open Graph URL, then check `/sitemap.xml` and `/robots.txt`. The sitemap and robots output must use the same production origin. Preview or staging URLs should be used for testing only; set `NEXT_PUBLIC_SITE_URL` to the real production origin when deploying the canonical site.

The application sends conservative security headers: MIME sniffing protection, strict-origin referrer handling, disabled camera/microphone/geolocation permissions, and `X-Frame-Options: DENY`. No restrictive Content Security Policy is enabled because the current application does not require one and Next.js behavior should remain uncomplicated.

To add a public entry, add a validated curated model or GPU record with a stable URL-safe slug, useful summary, HTTPS source URL/type, freshness date, and an honest confidence level. Model-card specifications and manufacturer GPU specifications must remain distinct from approximate GGUF planning inputs. Run the catalog tests and full validation commands before publishing. The project deliberately avoids mass-generated thin pages, scraping, and placeholder production records. To inspect pages locally, run `npm run build && npm start`, then open a real slug such as `/models/llama-3-2-1b-instruct` or `/gpus/rtx-4060-8gb`.

## Architecture

- `src/app/`: Next.js App Router and presentation code, including server-rendered catalog and `/guides/[slug]` pages plus sitemap/robots handlers.
- `src/domain/`: framework-independent types and Zod runtime schemas.
- `src/engine/`: deterministic compatibility calculations and named policies. This layer has no Next.js, UI, network, or AI dependencies and is directly unit-tested.
- `src/data/`: the curated production catalog, educational guide content, isolated synthetic fixtures, and registry helpers. `catalog.ts` is the access boundary for future model/GPU catalog growth; it is intentionally not exhaustive.

## Domain contract, provenance, and units

All memory values crossing the domain and engine boundary are expressed in GiB. IDs are stable machine-facing identifiers; display names and summaries are presentation metadata. Models and GPUs also have URL-safe stable slugs, so future `/models/[slug]` and `/gpus/[slug]` pages will not depend on UI object shapes. Dedicated GPU memory is `vramGiB`. Integrated GPUs may report zero dedicated VRAM and optional `sharedMemoryGiB`, which is deliberately not counted as dedicated VRAM by the first engine pass.

Catalog entries carry small provenance records (`source`, HTTPS `sourceUrl`, source type, confidence, ISO `lastVerified` date, and optional notes). Model and GPU records use official publisher/manufacturer sources where possible. Common GGUF quantization candidates are explicitly approximate because file size varies by conversion and model architecture. Schemas reject malformed slugs, dates, provenance, negative memory, and zero system RAM; catalog validation additionally checks duplicate IDs/slugs, duplicate quantization IDs, context ranges, integrated-GPU VRAM, HTTPS sources, and valid embedded quantization entries. Use `getModelById`/`getModelBySlug` and their GPU equivalents as the registry boundary.

## Initial calculation assumptions

The first engine pass estimates raw weights as `parameters × bits-per-weight ÷ 8`, applies a configurable 12% overhead multiplier, and adds 0.75 GiB runtime overhead. Estimated system RAM includes a 2 GiB reserved-system-memory allowance. An optional safety margin can be supplied through the compatibility policy. These are deliberately transparent, approximate heuristics—not benchmark results. Context length, backend, GPU architecture, KV-cache size, operating-system usage, and runtime settings can materially change real requirements.

The engine currently chooses the highest-bits-per-weight candidate that fits the supplied hardware, preserving model input order for ties. It distinguishes dedicated-GPU fit, partial offload, CPU-only, and unsupported results. Each result includes typed reason codes such as `insufficient-vram`, `insufficient-system-ram`, `integrated-shared-memory`, `exact-memory-boundary`, and `approximate-estimate`; the UI formats the associated messages without recreating the decision logic. Integrated/shared-memory handling is intentionally conservative, and no result promises a tokens-per-second rate.

## SEO/page architecture

Public catalog and guide pages use static params from small curated registries and metadata/canonical paths derived from their definitions. They provide useful explanations and provenance, then link to hardware-specific calculators rather than calculating anonymous compatibility at build time. The project intentionally has no mass-generated content, scraping, authentication, advertising, or database. Catalog entries and guides are curated rather than exhaustive: add them only when their sources, freshness, and usefulness can be reviewed manually.
