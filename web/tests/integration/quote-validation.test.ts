import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import type { LoanDetails } from '../../src/server/vendor/client.js';

const validLoanDetails: LoanDetails = {
  loanAmount: 25000000,
  loanTermInMonths: 240,
  riskBand: 'LOW',
};

const vendorQuote = {
  quoteId: 'a-quote-id',
  commissionRate: 0.015,
  totalCommission: 375000,
};

// A hand-written double. It records every call, so a test can show the vendor
// was never asked, and it always answers, so nothing here fails at random.
function createRecordingVendorClient() {
  const calls: LoanDetails[] = [];

  return {
    calls,
    requestQuote: async (loanDetails: LoanDetails) => {
      calls.push(loanDetails);
      return vendorQuote;
    },
  };
}

function postBody(vendorClient: ReturnType<typeof createRecordingVendorClient>, body: string) {
  return createApp({ vendorClient }).request('/api/quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

function postDetails(
  vendorClient: ReturnType<typeof createRecordingVendorClient>,
  overrides: Record<string, unknown>,
) {
  return postBody(vendorClient, JSON.stringify({ ...validLoanDetails, ...overrides }));
}

type ErrorEnvelope = { error: { code: string; message: string } };

// validateQuoteRequest owns inbound validation and short-circuits before the
// vendor is ever asked, so this suite proves it against the real route
// rather than a fake Hono Context.
describe('rejecting a request the vendor could not answer', () => {
  // SPEC-008/B5
  // SPEC-008/B6
  it('rejects a body that is not JSON without calling the vendor', async () => {
    const vendorClient = createRecordingVendorClient();

    const response = await postBody(vendorClient, 'not json at all');
    const body = (await response.json()) as ErrorEnvelope;

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_REQUEST');
    expect(body.error.message).toBe('Invalid input: expected object, received undefined');
    expect(vendorClient.calls).toEqual([]);
  });

  // SPEC-008/B5
  // SPEC-008/B6
  it('rejects a loan amount outside the allowed range without calling the vendor', async () => {
    const vendorClient = createRecordingVendorClient();

    const response = await postDetails(vendorClient, { loanAmount: 99_999 });
    const body = (await response.json()) as ErrorEnvelope;

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_REQUEST');
    expect(body.error.message).toBe('Too small: expected number to be >=100000');
    expect(vendorClient.calls).toEqual([]);
  });

  // SPEC-008/B5
  it('rejects a loan term outside the allowed range', async () => {
    const response = await postDetails(createRecordingVendorClient(), { loanTermInMonths: 481 });
    const body = (await response.json()) as ErrorEnvelope;

    expect(response.status).toBe(400);
    expect(body.error.message).toBe('Too big: expected number to be <=480');
  });

  // SPEC-008/B5
  it('rejects an unrecognised risk band', async () => {
    const response = await postDetails(createRecordingVendorClient(), { riskBand: 'D' });
    const body = (await response.json()) as ErrorEnvelope;

    expect(response.status).toBe(400);
    expect(body.error.message).toBe('Invalid option: expected one of "LOW"|"MEDIUM"|"HIGH"');
  });

  // SPEC-008/B5
  it('names the first bad field when two fields are bad', async () => {
    const response = await postDetails(createRecordingVendorClient(), {
      loanAmount: 99_999,
      riskBand: 'D',
    });
    const body = (await response.json()) as ErrorEnvelope;

    expect(body.error.message).toBe('Too small: expected number to be >=100000');
  });
});
