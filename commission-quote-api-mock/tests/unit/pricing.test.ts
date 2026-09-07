import { describe, expect, it } from 'vitest';
import { rateForRiskBand, totalCommissionInCents } from '../../src/pricing.js';

// The rates are invented for the stand-in, so ADR-001 keeps them out of the
// contract suite. They are checked here.
// SPEC-003/B1
describe('the rate for a risk band', () => {
  it('gives the low band its own fixed rate', () => {
    expect(rateForRiskBand('LOW')).toBe(0.015);
  });

  it('gives the medium band its own fixed rate', () => {
    expect(rateForRiskBand('MEDIUM')).toBe(0.0125);
  });

  it('gives the high band its own fixed rate', () => {
    expect(rateForRiskBand('HIGH')).toBe(0.01);
  });
});

// SPEC-003/B2
describe('the total commission', () => {
  // 250 cents at 0.01 is 2.5 cents, so this proves the multiplication and the
  // rounding direction in one.
  it('multiplies the loan amount by the rate and rounds half a cent up', () => {
    expect(totalCommissionInCents(250, 0.01)).toBe(3);
  });
});
