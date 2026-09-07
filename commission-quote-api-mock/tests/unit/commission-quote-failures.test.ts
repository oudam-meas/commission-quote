import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { type Outcome, pickOutcome } from '../../src/outcome.js';

const configuredApiKey = 'unit-test-key';

// Every field is valid, so the only thing that decides the answer here is the
// picked outcome or the api-key.
const validRequest = { loanAmount: 250000, loanTermInMonths: 240, riskBand: 'LOW' };

type QuoteResponseBody = {
  quoteId?: string;
  commissionRate?: number;
  totalCommission?: number;
  error?: { code?: string; message?: string };
};

// A hand-written picker. It ignores the random number the route hands it and
// answers with the outcome the test named, so no test in this file depends on
// chance.
function pickerAlwaysReturning(outcome: Outcome) {
  return () => outcome;
}

async function postQuote(outcome: Outcome, apiKey: string) {
  const app = createApp({ pickOutcome: pickerAlwaysReturning(outcome) });

  const response = await app.request('/commission-quote', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(validRequest),
  });

  return { status: response.status, body: (await response.json()) as QuoteResponseBody };
}

describe('the commission quote route with a picked outcome', () => {
  // stubEnv rather than assignment. Assigning undefined to process.env stores
  // the string "undefined", which would leak into the next file.
  beforeEach(() => {
    vi.stubEnv('API_KEY', configuredApiKey);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // SPEC-004/B4
  it('prices the quote when the outcome is success', async () => {
    const { status, body } = await postQuote('success', configuredApiKey);

    expect(status).toBe(200);
    expect(body.totalCommission).toBe(3750);
  });

  // SPEC-004/B2
  it('answers with a server error when the outcome is error', async () => {
    const { status } = await postQuote('error', configuredApiKey);

    expect(status).toBe(500);
  });

  // SPEC-004/B2
  it('names the failure VENDOR_ERROR in the error body', async () => {
    const { body } = await postQuote('error', configuredApiKey);

    expect(body.error?.code).toBe('VENDOR_ERROR');
  });

  // SPEC-004/B3
  it('answers with a gateway timeout when the outcome is timeout', async () => {
    const { status } = await postQuote('timeout', configuredApiKey);

    expect(status).toBe(504);
  });

  // SPEC-004/B3
  it('names the failure VENDOR_TIMEOUT in the error body', async () => {
    const { body } = await postQuote('timeout', configuredApiKey);

    expect(body.error?.code).toBe('VENDOR_TIMEOUT');
  });

  // The bound is loose on purpose. It is here to catch a real sleep before the
  // 504, and a request handled in process is far quicker than this.
  // SPEC-004/B3
  it('answers the timeout straight away instead of waiting', async () => {
    const startedAt = Date.now();

    await postQuote('timeout', configuredApiKey);

    expect(Date.now() - startedAt).toBeLessThan(1000);
  });

  // SPEC-004/B5
  it('rejects a wrong api-key before it reaches the pick', async () => {
    const { status } = await postQuote('error', 'not-the-configured-key');

    expect(status).toBe(401);
  });

  // SPEC-004's edge case table: the pick never applies to the health check.
  // Pinning the picker to error is what proves it, since the ready-built app
  // would only show this one time in ten.
  // SPEC-004/B6
  it('answers the health check while the picked outcome is error', async () => {
    const app = createApp({ pickOutcome: pickerAlwaysReturning('error') });

    const response = await app.request('/health');

    expect(response.status).toBe(200);
  });
});

// The real picker runs here. A double would leave this test proving nothing:
// it would stay green while the route hands the picker a rate it never read
// from the environment.
async function postQuoteWithRealPicker(apiKey: string) {
  const app = createApp({ pickOutcome });

  const response = await app.request('/commission-quote', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(validRequest),
  });

  return response.status;
}

// A route that reads the rate from config answers every one of these. A route
// holding a hard-coded 0.2 fails about one in five, so a hundred requests catch
// it with a chance of about one in five billion of slipping through.
const requestCount = 100;

describe('the commission quote route with the failure rate turned off', () => {
  beforeEach(() => {
    vi.stubEnv('API_KEY', configuredApiKey);
    vi.stubEnv('FAILURE_RATE', '0');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // SPEC-004/B7
  it('prices every request when the environment turns failures off', async () => {
    const statuses: number[] = [];

    for (let request = 0; request < requestCount; request += 1) {
      statuses.push(await postQuoteWithRealPicker(configuredApiKey));
    }

    // Listing only the statuses that were not 200 keeps a red result short and
    // names the failures it saw.
    expect(statuses.filter((status) => status !== 200)).toEqual([]);
  });
});
