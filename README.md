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

Results show GPU-capable, partial-offload, CPU-only, or unsupported classifications, approximate VRAM/RAM estimates, quantization recommendations, limiting factors, context guidance, and the assumptions/warnings used by the engine. The estimates are not performance benchmarks or guarantees. Recommendations rank the small curated production catalog deterministically; browser hardware scanning is only an optional best-effort convenience and does not replace manual entry.

## Optional browser hardware scan

Both hardware workflows include a `Scan my device` control. It runs locally in the browser and may report an operating-system hint, logical processor count, coarse `deviceMemory`, and a WebGL/WebGPU renderer hint when those APIs are available. Browser privacy settings and feature support vary, so unavailable values are expected. The scan never sends hardware details to a server, stores them, or records analytics identifiers.

Exact CPU model, exact system RAM, dedicated GPU VRAM, driver details, and reliable integrated/discrete classification are intentionally not inferred. Exact VRAM is always shown as unknown unless a future browser capability exposes it safely. Renderer-based catalog suggestions are low-confidence and require an explicit user selection before values are copied into the editable form. Users can review and edit every applied hint, and scanning never submits a calculation; manual entry remains the reliable path.

## Public catalog pages and SEO

Curated real entries are available as useful server-rendered pages at `/models/[slug]` and `/gpus/[slug]`. Their slugs, summaries, metadata, provenance, source links, and quantization details come from `src/data/catalog.ts`; route components do not duplicate catalog records. Unknown slugs return a normal 404. The App Router also generates `/sitemap.xml` for the home, recommendations, real catalog pages, and educational guides, plus `/robots.txt` pointing crawlers at that sitemap.

### Curated catalog scope and source policy

The current curated catalog contains 22 model variants and 30 GPU profiles. It is a reviewed starting set, not an exhaustive or automatically refreshed inventory. Model coverage includes Llama 3.2 1B/3B, Llama 3.1 8B, and Llama 3.3 70B; Gemma 3 1B/4B/12B/27B; Qwen2.5 3B/7B, Qwen2.5-Coder 7B, Qwen3 4B/8B/14B/32B, and Qwen3.5 2B; DeepSeek-R1-Distill-Qwen 1.5B; Phi-3.5 Mini and Phi-4 Mini; Mistral 7B, Mistral Nemo 12B, and Mistral Small 3.2 24B. Qwen3.5 2B accepts image input, but this calculator estimates text weights only and does not model vision processing. Mistral's documentation marks Small 3.2 deprecated for new integrations; its entry is included for local GGUF memory planning, not as an API recommendation. GPU coverage includes older NVIDIA cards and the RTX 50-series 5060, 5060 Ti, 5070, 5070 Ti, 5080, and 5090; AMD RDNA 2/3/4 including both RX 9060 XT memory configurations; Intel Arc Alchemist/Battlemage; and AMD Radeon 780M integrated graphics. The selection fills documented size and memory-capacity gaps rather than aiming for exhaustive SKU coverage.

Model identity, publisher, model license, parameter count, and maximum context values link to publisher model cards. A publisher-defined default context is omitted when it is not documented; the engine reports practical context guidance as unavailable rather than assuming one. GGUF availability is separately attributed to the relevant conversion repository, and third-party files are identified as conversions rather than official publisher weights. The model `license` field describes the underlying publisher model; the catalog does not assert a separate license for a third-party conversion. The available Q4_K_M and Q8_0 candidates are approximate planning inputs: model weights are calculated from documented parameter count and the quantization's bits-per-weight, not copied from a particular download's byte size. Actual GGUF files can differ due to tensor layout, metadata, tokenizer, and conversion choices. GPU memory capacity/type and architecture are sourced from manufacturer specifications; integrated graphics are recorded with zero dedicated VRAM when no fixed dedicated allocation exists. Their shared system memory is deliberately left unspecified.

To add an entry, verify the publisher or manufacturer facts and exact source URLs, record the check date and confidence, and keep model-card provenance separate from conversion provenance. Omit fields that are not documented instead of inferring them. For community GGUF variants, verify the repository lists each quantization offered for that model; do not describe community conversions as official. Run `npm test` and the full project validation before adding the entry to production data. Catalog values can change, so freshness metadata should be reviewed periodically.

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

- `src/app/`: Next.js App Router and presentation code, including server-rendered catalog and `/guides/[slug]` pages plus sitemap/robots handlers. The shared `hardware-fields.tsx` mounts the optional local device-scan control for both workflows.
- `src/domain/`: framework-independent types and Zod runtime schemas.
- `src/application/browser-detection.ts`: typed, browser-only signal collection and pure parsing helpers. It is separate from compatibility-domain logic and has no server, network, storage, or analytics behavior.
- `src/engine/`: deterministic compatibility calculations and named policies. This layer has no Next.js, UI, network, or AI dependencies and is directly unit-tested.
- `src/data/`: the curated production catalog, educational guide content, isolated synthetic fixtures, and registry helpers. `catalog.ts` is the access boundary for future model/GPU catalog growth; it is intentionally not exhaustive.

## Domain contract, provenance, and units

All memory values crossing the domain and engine boundary are expressed in GiB. IDs are stable machine-facing identifiers; display names and summaries are presentation metadata. Models and GPUs also have URL-safe stable slugs used by the `/models` and `/gpus` indexes and their `/models/[slug]` and `/gpus/[slug]` detail pages. Dedicated GPU memory is `vramGiB`. Integrated GPUs may report zero dedicated VRAM and optional `sharedMemoryGiB`, which is deliberately not counted as dedicated VRAM by the first engine pass.

Catalog entries carry small provenance records (`source`, HTTPS `sourceUrl`, source type, confidence, ISO `lastVerified` date, and optional notes). Model and GPU records use official publisher/manufacturer sources where possible. Common GGUF quantization candidates are explicitly approximate because file size varies by conversion and model architecture. Schemas reject malformed slugs, dates, provenance, negative memory, and zero system RAM; catalog validation additionally checks duplicate IDs/slugs, duplicate quantization IDs, context ranges, integrated-GPU VRAM, HTTPS sources, and valid embedded quantization entries. Use `getModelById`/`getModelBySlug` and their GPU equivalents as the registry boundary.

## Initial calculation assumptions

The first engine pass estimates raw weights as `parameters × bits-per-weight ÷ 8`, applies a configurable 12% overhead multiplier, and adds 0.75 GiB runtime overhead. Estimated system RAM includes a 2 GiB reserved-system-memory allowance. An optional safety margin can be supplied through the compatibility policy. These are deliberately transparent, approximate heuristics—not benchmark results. Context length, backend, GPU architecture, KV-cache size, operating-system usage, and runtime settings can materially change real requirements.

Context guidance is a separate advisory result and does not feed the existing memory estimate or compatibility classification. When a model has valid default and maximum context metadata, the engine reports the model maximum and recommends the lower of that model default and the configured conservative default (4,096 tokens by default). This is a practical starting point, not a claim that the maximum will fit. The result includes medium-confidence advisory status, assumptions, and stable reason codes for the model limit, conservative guidance, and approximate context assumptions. If context metadata is missing, partial, or inconsistent, the engine reports an unavailable recommendation rather than inventing one. Catalog validation permits incomplete context metadata so a real entry is not blocked solely because its publisher does not document both values; the resulting uncertainty remains explicit in the engine and UI. It does not estimate KV-cache size, runtime-specific context memory, or performance.

### Context calibration basis

The context policy is reviewed against a small deterministic fixture matrix in `src/engine/context-calibration-fixtures.ts`, covering small, medium, and larger models, multiple quantization levels, GPU-capable, partial-offload, CPU-only, integrated-GPU, and unsupported hardware, plus low, medium, and high model context limits. These fixtures verify that practical guidance never exceeds the model maximum, unavailable metadata remains unavailable, boundary memory behavior is stable, and context guidance cannot silently alter compatibility classification. The fixture matrix is a regression tool, not a benchmark corpus: it contains no runtime measurements, telemetry, KV-cache constants, or tokens-per-second claims. Values supported directly by catalog metadata are the model context limits; the practical starting point is a configurable conservative policy choice; context-related memory cost and real runtime behavior remain unknowable to this estimator.

The engine currently chooses the highest-bits-per-weight candidate that fits the supplied hardware, preserving model input order for ties. It distinguishes dedicated-GPU fit, partial offload, CPU-only, and unsupported results. Each result includes typed reason codes such as `insufficient-vram`, `insufficient-system-ram`, `integrated-shared-memory`, `exact-memory-boundary`, `approximate-estimate`, `model-context-limit`, `conservative-context-guidance`, and `context-estimation-unavailable`; the UI formats the associated messages without recreating the decision logic. Integrated/shared-memory handling is intentionally conservative, and no result promises a tokens-per-second rate.

### Optional runtime profile

The calculator and recommendations flow accept an optional, advisory `RuntimeProfile` through the application boundary. It currently supports `llama.cpp` or `unknown` as the runtime, `cpu`, `cuda`, `vulkan`, `metal`, or `unknown` as the backend/device path, the preferences `automatic`, `full-gpu`, `partial-offload`, or `cpu`, and an optional positive-integer target context length. The profile is separate from hardware catalog records and does not change memory formulas, compatibility classifications, or recommendation ranking.

Selected runtime values are shown as assumptions. Backend support, drivers, model conversion, layer placement, exact context memory, and performance are not verified or predicted. A target context is compared only with the model maximum and the existing conservative practical guidance: values above either produce a warning, while incomplete context metadata produces explicit unavailable guidance. Omitting the profile, or leaving all fields unspecified, preserves the prior behavior exactly. Runtime-profile schemas and advisory behavior are independently tested in `src/application/hardware.test.ts` and `src/engine/runtime-profile.test.ts`.

## Runtime evidence review

The post-deployment accuracy review is recorded in `src/engine/runtime-evidence.ts`. It compares the current policy with primary llama.cpp documentation and publisher model cards without collecting runtime telemetry. The evidence supports the qualitative claims that quantization reduces weight storage, llama.cpp can offload a maximum possible number of layers to supported GPUs, and larger context settings require additional runtime memory. It does not support exact file-size, KV-cache, layer-placement, driver, or performance predictions for this estimator.

One catalog correction came from this review: Google documents 32K input context for Gemma 3 1B, while 128K applies to the larger Gemma 3 variants. The catalog now records 32,768 as that model's maximum. The practical starting point remains the separate configurable 4,096-token policy. Other production context values remain unchanged because the available evidence is either variant-specific, runtime-dependent, or not sufficient to justify a more precise correction. The evidence matrix deliberately labels those cases as approximate, conservative-policy, or currently unknowable.

## SEO/page architecture

Public model and GPU catalog indexes (`/models` and `/gpus`) link to the existing detail pages and summarize selected curated facts. Catalog detail and guide pages use static params from small reviewed registries and metadata/canonical paths derived from their definitions. They provide useful explanations and provenance, then link to hardware-specific calculators rather than calculating anonymous compatibility at build time. The project intentionally has no mass-generated content, scraping, authentication, advertising, or database. Catalog entries and guides are curated rather than exhaustive: add them only when their sources, freshness, and usefulness can be reviewed manually.
