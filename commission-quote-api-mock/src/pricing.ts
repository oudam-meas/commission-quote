export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH';

// The rates are invented for this stand-in. They only have to be plausible
// and fixed, so they are written here and nowhere else. The caller's schema
// already rejects anything outside these three bands, so there is no other
// case to return for.
export function rateForRiskBand(riskBand: RiskBand): number {
  if (riskBand === 'LOW') {
    return 0.015;
  }

  if (riskBand === 'MEDIUM') {
    return 0.0125;
  }

  return 0.01;
}

// Math.round because the rate produces a fraction of a cent, and a cent is the
// smallest unit we return. This is the only place rounding happens.
export function totalCommissionInCents(loanAmountInCents: number, rate: number): number {
  return Math.round(loanAmountInCents * rate);
}
