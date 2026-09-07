import { describe, expect, it } from 'vitest';
import { validateLoanDetails, validateQuote } from '../../../src/server/services/validation.js';

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

describe('validateLoanDetails', () => {
  // SPEC-008/B5
  it('accepts a valid body', () => {
    expect(validateLoanDetails(validLoanDetails)).toEqual({ valid: true, data: validLoanDetails });
  });

  // SPEC-008/B5
  it('rejects an invalid body with the schema\'s own message', () => {
    const result = validateLoanDetails({ ...validLoanDetails, loanAmount: 99_999 });

    expect(result).toEqual({
      valid: false,
      message: 'Too small: expected number to be >=100000',
    });
  });
});

describe('validateQuote', () => {
  // SPEC-008/B7
  it('accepts a valid vendor response', () => {
    expect(validateQuote(validQuote)).toEqual({ valid: true, data: validQuote });
  });

  // SPEC-008/B7
  it('names the field that broke the outbound contract', () => {
    const result = validateQuote({ ...validQuote, commissionRate: 12 });

    expect(result).toEqual({ valid: false, fieldNames: ['commissionRate'] });
  });
});
