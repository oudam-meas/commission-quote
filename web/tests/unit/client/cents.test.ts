import { describe, expect, it } from 'vitest';
import { centsToDollars, dollarsToCents } from '../../../src/client/money/cents';

describe('converting between dollars and cents', () => {
  // SPEC-006/B6
  it('turns an amount of dollars into whole cents', () => {
    expect(dollarsToCents(1234.56)).toBe(123456);
  });

  // Multiplying 19.99 by 100 in binary floating point gives 1998.9999999999998,
  // and the vendor takes whole cents only.
  // SPEC-006/B6
  it('gives a whole number of cents for an amount that multiplies imprecisely', () => {
    expect(dollarsToCents(19.99)).toBe(1999);
  });

  // SPEC-006/B7
  it('turns an amount of cents back into dollars', () => {
    expect(centsToDollars(123456)).toBe(1234.56);
  });
});
