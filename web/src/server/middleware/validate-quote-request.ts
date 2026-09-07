import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { RequestIdVariables } from 'hono/request-id';
import { validateLoanDetails } from '../services/validation.js';
import type { LoanDetails } from '../types.js';

export type AppVariables = RequestIdVariables & { requestBody: LoanDetails };

export async function validateQuoteRequest(
  context: Context<{ Variables: AppVariables }>,
  next: Next,
) {
  const requestBody: unknown = await context.req.json().catch(() => undefined);

  const inbound = validateLoanDetails(requestBody);
  if (!inbound.valid) {
    throw new HTTPException(400, {
      cause: { code: 'INVALID_REQUEST', message: inbound.message },
    });
  }

  context.set('requestBody', inbound.data);
  await next();
}
