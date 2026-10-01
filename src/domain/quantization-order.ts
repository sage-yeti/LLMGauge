import type { QuantizationDefinition } from "./types";

/** Metadata ordering only: documented bpw first, then descending bpw. */
export function compareQuantizationMetadata(
  a: QuantizationDefinition,
  b: QuantizationDefinition,
): number {
  if (a.bitsPerWeight === undefined)
    return b.bitsPerWeight === undefined ? 0 : 1;
  if (b.bitsPerWeight === undefined) return -1;
  return b.bitsPerWeight - a.bitsPerWeight;
}
