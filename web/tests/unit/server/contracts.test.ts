import { describe, expect, it } from 'vitest';
import { loanDetailsSchema, quoteSchema } from '../../../src/server/contracts.js';

// Amounts are integer cents. $250,000 over 20 years, the same figures the other
// server tests use.
const validLoanDetails = {
  loanAmount: 25000000,
  loanTermInMonths: 240,
  riskBand: 'LOW',
};

const validQuote = {
  quoteId: 'a-quote-id',
  commissionRate: 0.015,
  totalCommission: 375000,
};

function acceptsLoanDetails(overrides: Record<string, unknown>): boolean {
  return loanDetailsSchema.safeParse({ ...validLoanDetails, ...overrides }).success;
}

function acceptsQuote(overrides: Record<string, unknown>): boolean {
  return quoteSchema.safeParse({ ...validQuote, ...overrides }).success;
}

describe('the inbound loan details schema', () => {
  // SPEC-008/B5
  it('accepts a loan amount at either end of the range', () => {
    expect(acceptsLoanDetails({ loanAmount: 100_000 })).toBe(true);
    expect(acceptsLoanDetails({ loanAmount: 1_000_000_000 })).toBe(true);
  });

  // SPEC-008/B5
  it('rejects a loan amount below one thousand dollars', () => {
    expect(acceptsLoanDetails({ loanAmount: 99_999 })).toBe(false);
  });

  // SPEC-008/B5
  it('rejects a loan amount above ten million dollars', () => {
    expect(acceptsLoanDetails({ loanAmount: 1_000_000_001 })).toBe(false);
  });

  // SPEC-008/B5
  it('rejects a loan amount that is not a whole number of cents', () => {
    expect(acceptsLoanDetails({ loanAmount: 25_000_000.5 })).toBe(false);
  });

  // SPEC-008/B5
  it('accepts a term at either end of the range', () => {
    expect(acceptsLoanDetails({ loanTermInMonths: 1 })).toBe(true);
    expect(acceptsLoanDetails({ loanTermInMonths: 480 })).toBe(true);
  });

  // SPEC-008/B5
  it('rejects a term of zero months', () => {
    expect(acceptsLoanDetails({ loanTermInMonths: 0 })).toBe(false);
  });

  // SPEC-008/B5
  it('rejects a term of more than four hundred and eighty months', () => {
    expect(acceptsLoanDetails({ loanTermInMonths: 481 })).toBe(false);
  });

  // SPEC-008/B5
  it('rejects a term that is not a whole number of months', () => {
    expect(acceptsLoanDetails({ loanTermInMonths: 24.5 })).toBe(false);
  });

  // SPEC-008/B5
  it('accepts each of the three risk bands', () => {
    expect(acceptsLoanDetails({ riskBand: 'LOW' })).toBe(true);
    expect(acceptsLoanDetails({ riskBand: 'MEDIUM' })).toBe(true);
    expect(acceptsLoanDetails({ riskBand: 'HIGH' })).toBe(true);
  });

  // SPEC-008/B5
  it('rejects a risk band outside LOW, MEDIUM and HIGH', () => {
    expect(acceptsLoanDetails({ riskBand: 'D' })).toBe(false);
  });
});

describe('the outbound quote schema', () => {
  // SPEC-008/B7
  it('accepts a quote that meets the vendor contract', () => {
    expect(quoteSchema.safeParse(validQuote).success).toBe(true);
  });

  // SPEC-008/B7
  it('rejects an empty quote id', () => {
    expect(acceptsQuote({ quoteId: '' })).toBe(false);
  });

  // SPEC-008/B7
  it('rejects a commission rate of zero', () => {
    expect(acceptsQuote({ commissionRate: 0 })).toBe(false);
  });

  // SPEC-008/B7
  it('rejects a commission rate of one', () => {
    expect(acceptsQuote({ commissionRate: 1 })).toBe(false);
  });

  // SPEC-008/B7
  it('rejects a negative total commission', () => {
    expect(acceptsQuote({ totalCommission: -1 })).toBe(false);
  });

  // SPEC-008/B7
  it('rejects a total commission that is not whole cents', () => {
    expect(acceptsQuote({ totalCommission: 375000.5 })).toBe(false);
  });
});
