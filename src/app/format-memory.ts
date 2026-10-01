/** Preserve compact two-decimal display without rounding engine inputs. */
export function formatMemoryGiB(value: number): string {
  return `${Math.round(value * 100) / 100} GiB`;
}
