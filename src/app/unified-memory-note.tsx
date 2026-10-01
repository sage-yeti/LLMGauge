import type { CompatibilityResult } from "@/domain/types";

export function UnifiedMemoryNote({ result }: { result: CompatibilityResult }) {
  const reason = result.reasons.find(
    (item) => item.code === "unified-execution-unverified",
  );
  return reason ? <p className="card-warning">{reason.message}</p> : null;
}
