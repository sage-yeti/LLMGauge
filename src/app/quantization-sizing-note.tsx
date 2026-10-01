import type { QuantizationDefinition } from "@/domain/types";

export function QuantizationSizingNote({
  quantization,
}: {
  quantization: QuantizationDefinition;
}) {
  if (quantization.bitsPerWeight !== undefined) return null;
  return (
    <p className="catalog-note">
      {quantization.displayName} sourced file size:{" "}
      {quantization.sizeGiB?.toFixed(2)} GiB. Whole-model bits per weight is
      unavailable. File size excludes runtime and context memory; memory-fit
      estimates remain approximate.
    </p>
  );
}
