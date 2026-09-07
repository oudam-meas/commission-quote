import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';

// Every field is valid here, so a rejection test can spoil one field and
// nothing else.
const validRequest = { loanAmount: 250000, loanTermInMonths: 240, riskBand: 'LOW' };

// Pricing and validation are what this file checks, so the picked outcome is
// pinned to success by a hand-written double. The ready-built app picks at
// random, and a suite that depends on chance is not a suite.
const app = createApp({ pickOutcome: () => 'success', sleep: async () => {} });

type QuoteResponseBody = {
  quoteId?: string;
  commissionRate?: number;
  totalCommission?: number;
  error?: { code?: string; message?: string };
};

describe('the commission quote route', () => {
  // stubEnv rather than assignment. Assigning undefined to process.env stores
  // the string "undefined", which would leak into the next file.
  beforeEach(() => {
    vi.stubEnv('API_KEY', 'unit-test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function postQuote(body: Record<string, unknown>) {
    const response = await app.request('/commission-quote', {
      method: 'POST',
      headers: { 'api-key': 'unit-test-key', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    return { status: response.status, body: (await response.json()) as QuoteResponseBody };
  }

  // The picker is pinned to success here, so this is also the proof that a
  // picked success is priced. The rate and the amount are the mock's own
  // promise, and ADR-001 keeps them out of the contract suite.
  // SPEC-002/B3, SPEC-003/B2, SPEC-004/B4
  it('answers a request carrying the configured api-key with a priced quote', async () => {
    const { status, body } = await postQuote(validRequest);

    expect(status).toBe(200);
    expect(body.commissionRate).toBe(0.015);
    expect(body.totalCommission).toBe(3750);
  });

  // SPEC-003/B3
  it('gives each answer a quoteId that differs from the one before it', async () => {
    const first = await postQuote(validRequest);
    const second = await postQuote(validRequest);

    expect(second.body.quoteId).not.toBe(first.body.quoteId);
  });

  // SPEC-003/B4
  it('rejects a risk band it cannot price', async () => {
    const { status } = await postQuote({ ...validRequest, riskBand: 'D' });

    expect(status).toBe(400);
  });

  // A loan amount in cents cannot hold a fraction, and a rate applied to one
  // would return a part of a cent.
  // SPEC-003/B5
  it('rejects a loan amount that is not a whole number of cents', async () => {
    const { status } = await postQuote({ ...validRequest, loanAmount: 250000.5 });

    expect(status).toBe(400);
  });

  // Validation stops at what pricing needs. No rate depends on the term.
  // SPEC-003/B4, SPEC-003/B5
  it('prices a request that carries no loan term', async () => {
    const { status } = await postQuote({ loanAmount: 250000, riskBand: 'LOW' });

    expect(status).toBe(200);
  });
});
