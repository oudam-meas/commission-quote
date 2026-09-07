// The vendor takes and returns whole cents. The user types dollars. Converting
// happens here, at the one edge where dollars exist, so nothing rounds twice.

export function dollarsToCents(dollars: number): number {
  // 19.99 * 100 is 1998.9999999999998 in binary floating point, so this rounds.
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}
