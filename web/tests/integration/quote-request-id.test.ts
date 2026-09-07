import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import type { LoanDetails, VendorClient } from '../../src/server/vendor/client.js';
import { VendorStatusError } from '../../src/server/vendor/client.js';

const loanDetails: LoanDetails = {
  loanAmount: 25000000,
  loanTermInMonths: 240,
  riskBand: 'LOW',
};

const answeringVendor: VendorClient = {
  requestQuote: async () => ({
    quoteId: 'a-quote-id',
    commissionRate: 0.015,
    totalCommission: 375000,
  }),
};

const failingVendor: VendorClient = {
  requestQuote: async () => {
    throw new VendorStatusError(500);
  },
};

function postQuote(vendorClient: VendorClient) {
  return createApp({ vendorClient }).request('/api/quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(loanDetails),
  });
}

describe('tracing a quote request', () => {
  // SPEC-008/B8
  it('puts a request id on a successful quote', async () => {
    const response = await postQuote(answeringVendor);

    expect(response.headers.get('x-request-id')).toEqual(expect.stringMatching(/\S/));
  });

  // SPEC-008/B8
  it('puts a request id on a failed quote', async () => {
    const response = await postQuote(failingVendor);

    expect(response.headers.get('x-request-id')).toEqual(expect.stringMatching(/\S/));
  });

  // SPEC-008/B8
  it('gives each request its own id', async () => {
    const first = await postQuote(answeringVendor);
    const second = await postQuote(answeringVendor);

    expect(first.headers.get('x-request-id')).not.toBe(second.headers.get('x-request-id'));
  });
});
