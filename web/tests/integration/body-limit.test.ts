import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import type { LoanDetails, VendorClient } from '../../src/server/vendor/client.js';

const loanDetails: LoanDetails = {
  loanAmount: 25000000,
  loanTermInMonths: 240,
  riskBand: 'LOW',
};

type ErrorEnvelope = { error: { code: string; message: string } };

// A hand-written double. If the body limit is not rejecting the request
// before this is ever reached, the test would call the vendor — it never
// should.
function createRecordingVendorClient(): VendorClient & { calls: LoanDetails[] } {
  const calls: LoanDetails[] = [];

  return {
    calls,
    requestQuote: async (details) => {
      calls.push(details);
      return { quoteId: 'a-quote-id', commissionRate: 0.015, totalCommission: 375000 };
    },
  };
}

describe('the body limit, mounted on every route', () => {
  // SPEC-008/B8
  it('rejects an oversized body with 413, without calling the vendor', async () => {
    const vendorClient = createRecordingVendorClient();
    const oversizedBody = JSON.stringify({ ...loanDetails, riskBand: 'X'.repeat(20_000) });

    const response = await createApp({ vendorClient }).request('/api/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: oversizedBody,
    });
    const body = (await response.json()) as ErrorEnvelope;

    expect(response.status).toBe(413);
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(vendorClient.calls).toEqual([]);
    expect(response.headers.get('x-request-id')).toEqual(expect.stringMatching(/\S/));
  });

  it('still accepts a normal-sized body', async () => {
    const vendorClient = createRecordingVendorClient();

    const response = await createApp({ vendorClient }).request('/api/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(loanDetails),
    });

    expect(response.status).toBe(200);
  });
});
