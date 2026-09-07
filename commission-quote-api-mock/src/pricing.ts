// The rates are invented for this stand-in. They only have to be plausible
// and fixed, so they are written here and nowhere else.
export function rateForRiskBand(riskBand: string): number | undefined {
  if (riskBand === 'LOW') {
    return 0.015;
  }

  if (riskBand === 'MEDIUM') {
    return 0.0125;
  }

  if (riskBand === 'HIGH') {
    return 0.01;
  }

  // A band with no rate is what gives the route its 400 branch.
  return undefined;
}

// Math.round because the rate produces a fraction of a cent, and a cent is the
// smallest unit we return. This is the only place rounding happens.
export function totalCommissionInCents(loanAmountInCents: number, rate: number): number {
  return Math.round(loanAmountInCents * rate);
}
