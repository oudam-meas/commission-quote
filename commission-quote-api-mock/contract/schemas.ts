import { z } from 'zod';

// The two request fields the mock actually uses. ADR-001 also names
// loanTermInMonths, but no rate in pricing.ts depends on it, so it was never
// validated and this schema does not start now — a request without one
// still prices, per this mock's own tests. Used by src/app.ts alone; the
// contract test sends a fixed fixture instead of validating the request.
export const commissionQuoteRequestSchema = z.object({
  loanAmount: z.number().int().positive(),
  riskBand: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});

// The three schemas below are the contract test's alone, checking what a
// vendor answers rather than what the mock accepts. Each states shape and
// constraint and never a value, because a correct vendor implementation
// nobody here has seen has to pass the contract test unedited. z.object
// ignores keys it does not name, so a vendor that returns more fields than
// we agreed stays green.

export const healthBody = z.object({
  status: z.string().min(1),
});

// One envelope for every error the contract covers, per ADR-001.
export const errorBody = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

// A rate is a fraction, so it sits between 0 and 1. Money is whole cents, so
// totalCommission is an integer and cannot be owed backwards.
export const quoteBody = z.object({
  quoteId: z.string().min(1),
  commissionRate: z.number().gt(0).lt(1),
  totalCommission: z.number().int().nonnegative(),
});
