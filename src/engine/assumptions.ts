import type { CompatibilityPolicy } from "@/domain/types";

/** Deliberately conservative first-pass estimates, not benchmark measurements. */
export const DEFAULT_COMPATIBILITY_POLICY: CompatibilityPolicy = {
  weightOverheadMultiplier: 1.12,
  runtimeOverheadGiB: 0.75,
  systemRamReserveGiB: 2,
  availableMemorySafetyMarginGiB: 0,
  defaultContextLength: 4096,
};
