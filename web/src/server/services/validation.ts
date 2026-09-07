import { loanDetailsSchema, quoteSchema } from '../contracts.js';
import type { LoanDetails, Quote } from '../types.js';

export type LoanDetailsValidation =
  | { valid: true; data: LoanDetails }
  | { valid: false; message: string };

export function validateLoanDetails(body: unknown): LoanDetailsValidation {
  const result = loanDetailsSchema.safeParse(body);
  if (!result.success) {
    return { valid: false, message: result.error.issues[0]!.message };
  }

  return { valid: true, data: result.data };
}

export type QuoteValidation = { valid: true; data: Quote } | { valid: false; fieldNames: string[] };

// Runs the response contract against the vendor's raw reply.
export function validateQuote(vendorResponse: unknown): QuoteValidation {
  const result = quoteSchema.safeParse(vendorResponse);
  if (!result.success) {
    return { valid: false, fieldNames: result.error.issues.map((issue) => String(issue.path[0])) };
  }

  return { valid: true, data: result.data };
}
