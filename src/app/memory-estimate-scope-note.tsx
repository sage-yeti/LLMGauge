import type { MemoryEstimateScope } from "@/domain/types";

export function MemoryEstimateScopeNote({
  scope,
}: {
  scope: MemoryEstimateScope;
}) {
  const description =
    scope.auxiliaryVisionFiles === "excluded"
      ? "This estimate excludes the separate vision/projector file and its runtime memory."
      : "The catalog has not verified whether the selected GGUF weights include all multimodal components or require separate files. Multimodal runtime memory is not estimated and may be missing from this result.";

  return (
    <p className="provenance-note memory-estimate-scope-note">
      <strong>Multimodal memory scope:</strong> {description}{" "}
      <a href={scope.sourceUrl} target="_blank" rel="noreferrer">
        {scope.source}
      </a>
    </p>
  );
}
