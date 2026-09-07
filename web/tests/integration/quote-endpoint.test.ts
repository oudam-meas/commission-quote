import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';

type LoanDetails = {
  loanAmount: number;
  loanTermInMonths: number;
  riskBand: string;
};

// The loan amount is in cents. The client converts what the user typed, so the
// server hands the vendor the same number it received.
const loanDetails: LoanDetails = {
  loanAmount: 25000000,
  loanTermInMonths: 240,
  riskBand: 'LOW',
};

const vendorQuote = {
  quoteId: 'a-quote-id',
  commissionRate: 0.015,
  totalCommission: 375000,
};

// A hand-written double. It records what it was asked and always answers, so
// nothing here needs the vendor running and nothing here can fail at random.
function createVendorClientDouble() {
  const received: LoanDetails[] = [];

  return {
    received,
    requestQuote: async (details: LoanDetails) => {
      received.push(details);
      return vendorQuote;
    },
  };
}

function postQuote(vendorClient: ReturnType<typeof createVendorClientDouble>) {
  return createApp({ vendorClient }).request('/api/quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(loanDetails),
  });
}

describe('the quote endpoint', () => {
  // SPEC-006/B1
  it('gives the loan details to the vendor client', async () => {
    const vendorClient = createVendorClientDouble();

    await postQuote(vendorClient);

    expect(vendorClient.received).toEqual([loanDetails]);
  });

  // SPEC-006/B1
  it('answers with the quote the vendor returned', async () => {
    const response = await postQuote(createVendorClientDouble());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(vendorQuote);
  });
});
