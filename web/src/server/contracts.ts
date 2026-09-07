import { z } from 'zod';

// One file read in both directions, so the contract is written once. The
// bounds are ours: the brief fixes none.
export const loanDetailsSchema = z.object({
  // Integer cents, $1,000 to $10,000,000. Both ends are accepted. The bound
  // messages speak dollars because the form does; the API itself is cents.
  loanAmount: z
    .number()
    .int()
    .min(100_000, 'Loan amount must be at least $1,000')
    .max(1_000_000_000, 'Loan amount must be at most $10,000,000'),
  loanTermInMonths: z.number().int().min(1).max(480),
  riskBand: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});

// The response contract, the same shape the stand-in's contract suite checks.
// A rate at either end is excluded, because neither is a real rate.
export const quoteSchema = z.object({
  quoteId: z.string().min(1),
  commissionRate: z.number().gt(0).lt(1),
  totalCommission: z.number().int().min(0),
});
