import type { CompatibilityResult } from "@/domain/types";
import { formatMemoryGiB } from "./format-memory";

const placementLabels = {
  "unified-memory": "Unified memory",
  "system-ram": "System RAM",
  vram: "Dedicated VRAM",
  unverified: "Unverified",
  unavailable: "Unavailable",
} as const;

export function KvCacheResult({
  result,
  headingId = "kv-cache-result-heading",
}: {
  result: CompatibilityResult;
  headingId?: string;
}) {
  const { kvCache } = result;
  return (
    <section className="context-guidance" aria-labelledby={headingId}>
      <h3 id={headingId}>Memory including target context</h3>
      <p>{kvCache.reason}</p>
      <dl className="context-guidance-stats">
        <div>
          <dt>Model weights (approx.)</dt>
          <dd>{formatMemoryGiB(result.memory.modelWeightsGiB)}</dd>
        </div>
        <div>
          <dt>Target context</dt>
          <dd>
            {kvCache.targetContextLength === null
              ? "Not supplied"
              : `${kvCache.targetContextLength.toLocaleString()} tokens`}
          </dd>
        </div>
        <div>
          <dt>KV cache ({kvCache.precision} assumption)</dt>
          <dd>
            {kvCache.status === "estimated"
              ? formatMemoryGiB(kvCache.sizeGiB!)
              : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt>Cache placement</dt>
          <dd>{placementLabels[kvCache.placement]}</dd>
        </div>
        <div>
          <dt>Fit accounting</dt>
          <dd>
            {kvCache.includedInFit
              ? "KV cache included in the assessed memory total"
              : "KV cache not included in the fit decision"}
          </dd>
        </div>
        <div>
          <dt>Total assessed VRAM (approx.)</dt>
          <dd>
            {result.memory.estimatedVramGiB === null
              ? "Not applicable"
              : formatMemoryGiB(result.memory.estimatedVramGiB)}
          </dd>
        </div>
        <div>
          <dt>
            {result.memory.estimatedUnifiedMemoryGiB !== undefined
              ? "Total assessed unified memory (approx.)"
              : "Total assessed system RAM (approx.)"}
          </dt>
          <dd>{formatMemoryGiB(result.memory.estimatedSystemRamGiB)}</dd>
        </div>
      </dl>
      <p>
        This FP16 cache estimate is approximate. It does not establish backend
        support, actual allocation, or performance.
      </p>
      {kvCache.sourceUrl && (
        <p>
          Architecture metadata source:{" "}
          <a href={kvCache.sourceUrl} target="_blank" rel="noreferrer">
            model-specific source
          </a>
        </p>
      )}
    </section>
  );
}
