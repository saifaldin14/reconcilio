/** Round to 2 decimal places (currency-safe for display/comparison). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Whole-day difference between two ISO `YYYY-MM-DD` dates. */
export function daysBetween(a: string, b: string): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return Math.round(ms / (1000 * 60 * 60 * 24));
}
