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

The `/recommendations` route implements the second core workflow: “What can my PC run?”. It reuses the shared hardware controls and `parseHardwareForm` boundary, evaluates every valid catalog quantization through the same compatibility engine, and returns one deterministic representative per model. Usable results are ranked ahead of unsupported results using this policy: compatibility level first (`GPU-capable`, `partial-offload`, `CPU-only`, then `unsupported`), documented bits-per-weight before unavailable values at the same level, higher documented bits-per-weight next, lower estimated VRAM next, then stable model and quantization IDs. This is a metadata ordering policy, not a claim about model quality. Missing bits-per-weight is never replaced by zero or an invented value. Quantization selection uses the same known-before-unavailable comparator and retains its existing first-usable-candidate behavior and stable input-order tie-breaker; existing known-bpw candidates keep their ordering. Unsupported representatives are kept in a separate expandable section rather than mixed into the default recommendations.

Results show GPU-capable, partial-offload, CPU-only, or unsupported classifications, approximate VRAM/RAM estimates, quantization recommendations, limiting factors, context guidance, and the assumptions/warnings used by the engine. The estimates are not performance benchmarks or guarantees. Recommendations rank the small curated production catalog deterministically; browser hardware scanning is only an optional best-effort convenience and does not replace manual entry.

## Optional browser hardware scan

Both hardware workflows include a `Scan my device` control. It runs locally in the browser and may report an operating-system hint, logical processor count, coarse `deviceMemory`, and a WebGL/WebGPU renderer hint when those APIs are available. Browser privacy settings and feature support vary, so unavailable values are expected. The scan never sends hardware details to a server, stores them, or records analytics identifiers.

Exact CPU model, exact system RAM, dedicated GPU VRAM, driver details, and reliable integrated/discrete classification are intentionally not inferred. Exact VRAM is always shown as unknown unless a future browser capability exposes it safely. Renderer-based catalog suggestions are low-confidence and require an explicit user selection before values are copied into the editable form. Users can review and edit every applied hint, and scanning never submits a calculation; manual entry remains the reliable path.

## Public catalog pages and SEO

Curated real entries are available as useful server-rendered pages at `/models/[slug]` and `/gpus/[slug]`. Their slugs, summaries, metadata, provenance, source links, and quantization details come from `src/data/catalog.ts`; route components do not duplicate catalog records. Unknown slugs return a normal 404. The App Router also generates `/sitemap.xml` for the home, recommendations, real catalog pages, and educational guides, plus `/robots.txt` pointing crawlers at that sitemap.

### Curated catalog scope and source policy

The current curated catalog contains 54 model variants and 64 GPU profiles. It is a reviewed starting set, not an exhaustive or automatically refreshed inventory. Model coverage includes Llama 3.2 1B/3B, Llama 3.1 8B, and Llama 3.3 70B; Gemma 3 1B/4B/12B/27B, Gemma 3n E2B/E4B, and Gemma 4 E4B/12B/26B-A4B/31B; Qwen2.5 3B/7B, Qwen2.5-Coder 7B, Qwen3 4B/8B/14B/32B and Qwen3-30B-A3B-Instruct-2507, Qwen3-Coder-30B-A3B-Instruct, and Qwen3-Coder-Next; Qwen3-VL 8B Instruct and 30B-A3B Instruct; Qwen3.5 0.8B/2B/4B/9B/122B-A10B, Qwen3.6 27B/35B-A3B, and Qwen3.8 27B; GLM-4.7-Flash; DeepSeek-R1-Distill-Qwen 1.5B and DeepSeek V4 Flash 0731; Phi-3.5 Mini and Phi-4 Mini; Ministral 3 14B Instruct, Devstral Small 2 24B Instruct, Mistral 7B, Mistral Nemo 12B, Mistral Small 3.2 24B, and Mistral Small 4 119B-A6B; LFM2-24B-A2B and LFM2.5 2.6B; NVIDIA Nemotron 3 Nano 30B-A3B and Super 120B-A12B; Laguna S 2.1; Muse Glimmer 30B; PrismML Bonsai 2 27B; and OpenAI gpt-oss-20b/120b. The Batch 35 review priority order was OpenAI gpt-oss-20b, Qwen3-Coder-30B-A3B-Instruct, Qwen3-30B-A3B-Instruct-2507, GLM-4.7-Flash, Qwen3-Coder-Next, OpenAI gpt-oss-120b, Qwen3.5-122B-A10B, Gemma 3n E2B IT, and Gemma 3n E4B IT. The two GPT-OSS entries now use their main-model MXFP4 GGUF file sizes with whole-model bits-per-weight omitted. Batch 37 review priority was Qwen3-VL 8B, Qwen3-VL 30B-A3B, Qwen3-Coder 30B-A3B (already cataloged), Qwen3-Coder-Next 80B-A3B (already cataloged), GLM-4.7-Flash (already cataloged), Ministral 3 14B, Devstral Small 2 24B, LFM2-24B-A2B, Gemma 3n E4B (already cataloged), Nemotron 3 Nano 30B-A3B, Mistral Small 4 119B-A6B, Nemotron 3 Super 120B-A12B, and Laguna S 2.1. Image-capable Gemma 3/3n/4, Qwen3-VL/3.5/3.6/3.8, Ministral 3, Devstral Small 2, Mistral Small 3.2/4, Muse Glimmer, and Bonsai entries carry a model-page and result note describing whether auxiliary vision/projector files are excluded or their inclusion is unverified; Gemma 3n, Qwen3.5 122B-A10B, Qwen3-VL, Ministral 3, Devstral Small 2, and Mistral Small 4 also state that multimodal runtime memory is not separately estimated. Mistral's documentation marks Small 3.2 deprecated for new integrations; its entry is included for local GGUF memory planning, not as an API recommendation. GPU coverage includes GeForce RTX 20/30/40/50 series, with distinct desktop RTX 3050 6/8 GB and RTX 4060 Ti 8/16 GB profiles, laptop RTX 3060 and RTX 4050–4090 profiles, and variant-specific RTX 3080 records; Tesla P40, RTX A6000, and RTX A4000/A5000; Radeon AI PRO R9700 and AMD RDNA 2/3/4 GPUs; and Intel Arc Alchemist/Battlemage including Arc Pro B60/B65/B70. The selection fills documented size and memory-capacity gaps rather than aiming for exhaustive SKU coverage.

Model identity, publisher, model license, parameter count, and maximum context values link to publisher model cards. A publisher-defined default context is omitted when it is not documented; the engine reports practical context guidance as unavailable rather than assuming one. GGUF availability is separately attributed to the relevant conversion repository, with publisher-hosted and third-party conversions identified distinctly from publisher model weights. The model `license` field describes the underlying publisher model; the catalog does not assert a separate license for a conversion. Most Q4_K_M and Q8_0 candidates remain approximate planning inputs calculated from documented parameter count and bits-per-weight. Selected entries use conversion repositories' listed GGUF files and rounded decimal file sizes, converted to GiB; bits-per-weight remains the catalog's approximate planning value. The calculator uses the cataloged main-model weight input and standard runtime overhead. KV-cache memory is estimated separately only for models with sourced supported attention metadata and an explicit target context. For multimodal entries, a model-level note says when separate vision/projector files are excluded or when their inclusion in the selected weight source has not been verified. GPU memory capacity/type and architecture are sourced from manufacturer specifications; integrated graphics are recorded with zero dedicated VRAM when no fixed dedicated allocation exists. Their shared system memory is deliberately left unspecified.

To add an entry, verify the publisher or manufacturer facts and exact source URLs, record the check date and confidence, and keep model-card provenance separate from conversion provenance. Omit fields that are not documented instead of inferring them. For community GGUF variants, verify the repository lists each quantization offered for that model; do not describe community conversions as official. Run `npm test` and the full project validation before adding the entry to production data. Catalog values can change, so freshness metadata should be reviewed periodically.

## Educational guides

The `/guides` index and `/guides/[slug]` pages explain the concepts behind the results, including VRAM, quantization, GPU offloading, context length, and compatibility estimates. Guide content is typed local data in `src/data/guides.ts`; the reusable server-rendered template in `src/app/guide-page.tsx` handles layout, references, related links, and metadata without copying content into route files.

Each guide has a stable slug, a last-reviewed date, and the HTTPS references used for its technical claims. To add or update one, consult authoritative documentation, distinguish documented facts from simplified planning guidance, keep the explanation useful to non-experts, add relevant calculator or catalog links, and extend the guide tests. Run the full validation commands and inspect the generated page before publishing. The initial set is intentionally small: guides are curated educational pages, not mass-generated SEO content.

Set `NEXT_PUBLIC_SITE_URL` to the deployed origin before publishing so canonical URLs and sitemap entries use the public host. Local development falls back to `http://localhost:3000`. Titles and descriptions are derived from catalog fields and are intentionally concise; no benchmark, rating, or compatibility guarantee is implied.

### GPT-OSS artifact scope

OpenAI's [20b](https://huggingface.co/openai/gpt-oss-20b) and [120b](https://huggingface.co/openai/gpt-oss-120b) publisher cards and their linked [model-card PDF](https://cdn.openai.com/pdf/419b6906-9da6-406c-a19d-1bb078ac7637/oai_gpt-oss_model_card.pdf) document Apache-2.0, 20.91B/116.83B total parameters, 3.61B/5.13B active parameters, and a 131,072-token maximum context. No runtime default context is recorded. MXFP4 applies to MoE weights while other tensors use higher precision; its tensor-level precision is not encoded as a whole-model bits-per-weight value.

| Main-model artifact                                                                                           |   Source bytes | Sizing input                   |
| ------------------------------------------------------------------------------------------------------------- | -------------: | ------------------------------ |
| [gpt-oss-20b-MXFP4.gguf](https://huggingface.co/ggml-org/gpt-oss-20b-GGUF/raw/main/gpt-oss-20b-MXFP4.gguf)    | 12,109,566,624 | bytes / 2^30 (about 11.28 GiB) |
| [gpt-oss-120b-MXFP4.gguf](https://huggingface.co/ggml-org/gpt-oss-120b-GGUF/raw/main/gpt-oss-120b-MXFP4.gguf) | 63,387,346,208 | bytes / 2^30 (about 59.03 GiB) |

The exact byte values and SHA256 identifiers come from the ggml-org LFS artifact pointers, verified 2026-10-01. Each main model is one file; separate Eagle speculative-decoding files, repository totals, and native checkpoint sizes are excluded. Conversion provenance is separate from OpenAI's publisher provenance. A verified file size remains an input to an approximate memory estimate with the existing overhead/reserve policies; it does not measure runtime RAM/VRAM usage.

The [upstream llama.cpp GPT-OSS guide](https://github.com/ggml-org/llama.cpp/discussions/15396) documents native MXFP4 support, current builds, and the embedded Harmony chat template (`--jinja`). The model pages and both result workflows show that prerequisite. GPT-OSS cache architecture is not yet modeled, so its KV-cache estimate remains unavailable; compute buffers and actual allocation are also outside the estimate. No result guarantees backend compatibility or performance.

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

Catalog entries carry small provenance records (`source`, HTTPS `sourceUrl`, source type, confidence, ISO `lastVerified` date, and optional notes). Model and GPU records use official publisher/manufacturer sources where possible. Common GGUF quantization candidates are explicitly approximate because file size varies by conversion and model architecture. Quantizations require a positive finite `sizeGiB` or a positive finite `bitsPerWeight` of at most 16 (or both); file size takes precedence. Schemas reject malformed slugs, dates, provenance, negative memory, and zero system RAM; catalog validation additionally checks duplicate IDs/slugs, duplicate quantization IDs, context ranges, integrated-GPU VRAM, HTTPS sources, and valid embedded quantization entries. Use `getModelById`/`getModelBySlug` and their GPU equivalents as the registry boundary.

## Initial calculation assumptions

The first engine pass uses a cataloged quantization file size when available; otherwise it estimates raw weights in GiB as `(parameterCountBillions × 1_000_000_000 × bitsPerWeight ÷ 8) ÷ 2^30` only when a valid bits-per-weight value is present. The TypeScript contract, Zod schemas, catalog validation, and direct memory estimator require at least one usable sizing input and reject invalid supplied values even if the other input is usable. It applies a configurable 12% weight overhead multiplier and adds 0.75 GiB runtime overhead. Estimated system RAM adds a 2 GiB reserved-system-memory allowance to the VRAM estimate. An optional safety margin can be supplied through the compatibility policy. These are deliberately transparent, approximate heuristics—not benchmark results. The estimate covers the cataloged main-model weights plus configured weight and runtime overheads; KV-cache memory is shown separately when it can be estimated and safely assigned to a memory pool. Unlisted auxiliary model files, operating-system usage, and other runtime-specific allocations remain outside the estimate. Model entries that support image input carry a separate note stating whether their vision/projector files are known to be excluded or whether inclusion remains unverified.

### Weight units and fit precision correction (Batch 39)

The former fallback `parameterCountBillions × bitsPerWeight ÷ 8` produced decimal GB but treated that number as GiB. The corrected path first obtains bytes and divides by `2^30`. Supplied `sizeGiB` stays authoritative, including size-only GPT-OSS candidates. Policy multipliers, overheads, reserves, safety margins, and catalog inputs are unchanged.

`MemoryEstimate` now carries unrounded GiB values. Classification and the recommendation memory tie-breaker use those values; GPU/RAM fit remains inclusive (`available >= estimate + safety margin`). The exact-boundary reason compares against that same margin-inclusive threshold. Only result presentation rounds to compact two-decimal values; displaying equal values does not mean they have equal fit or ordering.

| Representative candidate                              | Previous estimated VRAM / RAM | Corrected estimated VRAM / RAM                      | Example classification change                                      |
| ----------------------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| 8B parameters, 4 bits/weight, default policy          | 5.23 / 7.23 GiB               | 4.922325134 / 6.922325134 GiB (display 4.92 / 6.92) | 5 GiB discrete VRAM and 7 GiB RAM: unsupported → GPU-capable       |
| Llama 3.1 8B Q4_K_M (4.5 bits/weight), default policy | 5.79 / 7.79 GiB               | 5.443865776 / 7.443865776 GiB (display 5.44 / 7.44) | 5.5 GiB discrete VRAM and 8 GiB RAM: partial-offload → GPU-capable |

For the first row, 4,000,000,000 weight bytes are 3.725290298 GiB before overhead. Sourced sizes do not undergo this fallback conversion. Removing premature rounding can still change fits very near their thresholds: a size-only 5.0001 GiB candidate requires about 6.350112 GiB VRAM and 8.350112 GiB RAM under the default policy. Both 6.350 and 6.351 GiB display as 6.35, but only the latter meets that VRAM requirement when RAM is sufficient. GPT-OSS inputs and displayed estimates remain unchanged; their fit checks now use the complete estimate rather than its display value.

Practical context guidance remains separate and advisory. An explicitly selected target context can additionally produce a KV-cache estimate when supported sourced architecture metadata is available. When a model has valid default and maximum context metadata, the engine reports the model maximum and recommends the lower of that model default and the configured conservative default (4,096 tokens by default). This is a practical starting point, not a claim that the maximum will fit. The result includes medium-confidence advisory status, assumptions, and stable reason codes for the model limit, conservative guidance, and approximate context assumptions. If context metadata is missing, partial, or inconsistent, the engine reports an unavailable recommendation rather than inventing one. Catalog validation permits incomplete context metadata so a real entry is not blocked solely because its publisher does not document both values; the resulting uncertainty remains explicit in the engine and UI. No model default or maximum is substituted as the target.

### Context calibration basis

The context policy is reviewed against a small deterministic fixture matrix in `src/engine/context-calibration-fixtures.ts`. Those fixtures validate practical guidance independently from KV-cache estimation; neither is a benchmark corpus. KV-cache estimates use a documented FP16 assumption and unrounded bytes-to-GiB conversion. For the currently supported Llama 3.1 8B Instruct metadata, the estimate is `2 × 32 layers × 8 KV heads × 128 head dimension × 2 bytes × target tokens ÷ 2^30`. At 4,096 tokens this is 0.5 GiB. No cache size is inferred for other models without sourced supported architecture metadata.

The engine currently chooses the highest-bits-per-weight candidate that fits the supplied hardware, preserving model input order for ties. It distinguishes dedicated-GPU fit, partial offload, CPU-only, and unsupported results. Each result includes typed reason codes such as `insufficient-vram`, `insufficient-system-ram`, `integrated-shared-memory`, `exact-memory-boundary`, `approximate-estimate`, `model-context-limit`, `conservative-context-guidance`, and `context-estimation-unavailable`; the UI formats the associated messages without recreating the decision logic. Integrated/shared-memory handling is intentionally conservative, and no result promises a tokens-per-second rate.

### Optional runtime profile

The calculator and recommendations flow accept an optional `RuntimeProfile` through the application boundary. It supports `llama.cpp` or `unknown` as the runtime, `cpu`, `cuda`, `vulkan`, `metal`, or `unknown` as the backend/device path, the preferences `automatic`, `full-gpu`, `partial-offload`, or `cpu`, and an optional positive-integer target context length. These remain advisory settings: they do not verify drivers, backend support, actual allocation, or performance. A supported cache estimate affects fit and memory ordering only when the selected settings establish its placement.

Selected runtime values are shown as assumptions. Backend support, drivers, model conversion, general layer placement, and performance are not verified or predicted. The target is checked against a documented model maximum when present. PC cache placement is included only for an explicit CPU selection or an explicit full-GPU preference with a selected CUDA/Vulkan backend and discrete GPU; automatic, partial-offload, or underspecified placement remains advisory and excluded from fit. Apple unified-memory mode includes a supported cache estimate in its single pool. When the target is omitted, no default or model maximum is silently substituted. Runtime-profile schemas and advisory behavior are independently tested in `src/application/hardware.test.ts` and `src/engine/runtime-profile.test.ts`.

## Runtime evidence review

The post-deployment accuracy review is recorded in `src/engine/runtime-evidence.ts`. It compares the current policy with primary llama.cpp documentation and publisher model cards without collecting runtime telemetry. The evidence supports the qualitative claims that quantization reduces weight storage, llama.cpp can offload a maximum possible number of layers to supported GPUs, and larger context settings require additional runtime memory. It does not support exact file-size, KV-cache, layer-placement, driver, or performance predictions for this estimator.

One catalog correction came from this review: Google documents 32K input context for Gemma 3 1B, while 128K applies to the larger Gemma 3 variants. The catalog now records 32,768 as that model's maximum. The practical starting point remains the separate configurable 4,096-token policy. Other production context values remain unchanged because the available evidence is either variant-specific, runtime-dependent, or not sufficient to justify a more precise correction. The evidence matrix deliberately labels those cases as approximate, conservative-policy, or currently unknowable.

## SEO/page architecture

Public model and GPU catalog indexes (`/models` and `/gpus`) link to the existing detail pages and summarize selected curated facts. Catalog detail and guide pages use static params from small reviewed registries and metadata/canonical paths derived from their definitions. They provide useful explanations and provenance, then link to hardware-specific calculators rather than calculating anonymous compatibility at build time. The project intentionally has no mass-generated content, scraping, authentication, advertising, or database. Catalog entries and guides are curated rather than exhaustive: add them only when their sources, freshness, and usefulness can be reviewed manually.

### Explicit Apple Silicon unified-memory planning

Both workflows offer an explicit `apple-unified` hardware mode, alongside the existing PC mode. Omitted `memoryMode` retains legacy PC behavior; macOS, generic integrated graphics, and browser scanning never enable Apple mode. Apple profiles require macOS, an editable chip/CPU name, and a positive finite `systemRamGiB` representing the **one total physical unified-memory pool**. Direct domain inputs with any separate GPU allocation are rejected. The shared form retains PC GPU/VRAM values for switching back, but excludes them from Apple submissions. Scanning remains local, optional, and explicitly applied; it cannot switch modes or replace Apple's macOS or GPU allocation fields.

The engine reuses sourced `sizeGiB` precedence and corrected fallback GiB weights. Required pooled memory is `weights × existing overhead multiplier + runtime overhead + system RAM reserve`. The fit check is inclusive against `required pooled memory + existing safety margin`, using unrounded values. Weights, reserve, and margin are each counted once. A passing result is **Fits estimated unified memory** (`unified-memory-fit`), with execution **Unverified (advisory)**; failure remains unsupported. Dedicated VRAM is null/not applicable, and `estimatedUnifiedMemoryGiB` records the pooled estimate. No GPU-accessible RAM percentage or Metal allocation limit is inferred.

Apple recommendations put fitting entries ahead of unsupported entries, then retain the known-before-unavailable bits-per-weight metadata policy, higher documented bits-per-weight, lower unrounded pooled memory, and stable model/quantization IDs. Existing PC ordering and classifications are unchanged. Context/KV-cache, multimodal auxiliary-file, model runtime-prerequisite, and optional runtime-profile caveats still apply. Total-memory fit does not establish CPU/Metal execution, backend availability, full GPU offload, or performance.

Policy evidence reviewed 2026-10-01:

- [Apple WWDC20 unified-memory architecture](https://developer.apple.com/videos/play/wwdc2020/10686/): CPU and GPU operate over the same memory pool.
- [Metal recommendedMaxWorkingSetSize](https://developer.apple.com/documentation/metal/mtldevice/recommendedmaxworkingsetsize): an approximate device working-set recommendation in bytes, distinct from total physical RAM; this planner does not query or predict it.
- [llama.cpp build documentation](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md): Metal is enabled by default in macOS builds but can be disabled, and GPU inference can be disabled separately. A platform or total-memory fit therefore cannot verify the user's actual runtime/build or allocation behavior.

### Context-aware memory planning (v1)

The FP16 K/V cache estimate is `2 × transformer layers × KV heads × head dimension × 2 bytes × target context tokens`, converted to GiB with `2^30`. Model architecture counts are stored in the model record with source provenance. The initial supported record is Llama 3.1 8B Instruct: [Meta’s official model repository](https://github.com/meta-llama/llama-models/blob/main/models/sku_list.py) lists 32 layers, dimension 4096, 32 attention heads, and 8 KV heads; its [publisher model card](https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct) identifies GQA. Head dimension is calculated from sourced dimension ÷ attention heads (4096 ÷ 32). The [llama.cpp model loader](https://github.com/ggml-org/llama.cpp/blob/master/src/llama-model.cpp) and [KV-cache implementation](https://github.com/ggml-org/llama.cpp/blob/master/src/llama-kv-cache.cpp) support the Llama architecture and conventional cache path; this does not establish a particular user's backend or runtime configuration. Other catalog architectures report cache as unavailable until their model-specific attention and cache behavior is supported, including architectures with mixed/sliding-window/latent attention.

No context target is inferred from the model default or maximum. A target beyond a documented maximum returns an unavailable estimate. Cache memory stays separate from weight and runtime-overhead fields. It enters PC system RAM for explicit CPU execution, dedicated VRAM only for an explicit full-GPU preference paired with CUDA/Vulkan and a discrete GPU, and the pooled Apple memory requirement in Apple mode. For automatic, partial-offload, or unclear placement, the cache remains visible but excluded from fit, with a warning that fit does not account for its placement. All cache estimates are approximate; precision is assumed FP16, fit uses unrounded values, and nothing here predicts successful loading, backend availability, or speed.
