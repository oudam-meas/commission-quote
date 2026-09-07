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

// A no-op stand-in for the real delay, so a test proving status codes and
// bodies does not also wait out a real timeout.
async function instantSleep(): Promise<void> {}

// Records every call instead of waiting, so a test can prove the timeout path
// actually asks to wait, and for how long.
function createRecordingSleep() {
  const calls: number[] = [];

  return { calls, sleep: async (ms: number) => { calls.push(ms); } };
}

async function postQuote(
  outcome: Outcome,
  apiKey: string,
  sleep: (ms: number) => Promise<void> = instantSleep,
) {
  const app = createApp({ pickOutcome: pickerAlwaysReturning(outcome), sleep });

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

  // SPEC-004/B2
  it('answers with a bad gateway when the outcome is badGateway', async () => {
    const { status } = await postQuote('badGateway', configuredApiKey);

    expect(status).toBe(502);
  });

  // SPEC-004/B2
  it('names the failure VENDOR_BAD_GATEWAY in the error body', async () => {
    const { body } = await postQuote('badGateway', configuredApiKey);

    expect(body.error?.code).toBe('VENDOR_BAD_GATEWAY');
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
  // 504, and a request handled in process is far quicker than this. A
  // "timeout" pick simulates a proxy (an ALB, say) answering on the vendor's
  // behalf; it is fast by nature. "slow" is the outcome that waits — see below.
  // SPEC-004/B3
  it('answers the timeout straight away instead of waiting', async () => {
    const startedAt = Date.now();

    await postQuote('timeout', configuredApiKey);

    expect(Date.now() - startedAt).toBeLessThan(1000);
  });

  // SPEC-004/B4
  it('prices the quote when the outcome is slow', async () => {
    const { status, body } = await postQuote('slow', configuredApiKey);

    expect(status).toBe(200);
    expect(body.totalCommission).toBe(3750);
  });

  // SPEC-004/B4
  it('genuinely waits before answering slow, long enough to outlast a real caller\'s own deadline', async () => {
    const recordingSleep = createRecordingSleep();

    await postQuote('slow', configuredApiKey, recordingSleep.sleep);

    expect(recordingSleep.calls).toHaveLength(1);
    // api's vendor client gives up at 3000ms. The mock has to outlast that,
    // or a real caller's own timeout would never actually fire.
    expect(recordingSleep.calls[0]).toBeGreaterThan(3000);
  });

  // SPEC-004/B8
  it('answers 200 when the outcome is malformed', async () => {
    const { status } = await postQuote('malformed', configuredApiKey);

    expect(status).toBe(200);
  });

  // A rate of 12 is not a fraction between 0 and 1 — the outbound contract
  // (web/src/server/contracts.ts's quoteSchema) rejects it. That is the
  // point: the shape looks right, one value inside it does not.
  // SPEC-004/B8
  it('breaks the outbound contract on commissionRate', async () => {
    const { body } = await postQuote('malformed', configuredApiKey);

    expect(body.commissionRate).toBe(12);
  });

  // SPEC-004/B8
  it('answers malformed straight away instead of waiting', async () => {
    const startedAt = Date.now();

    await postQuote('malformed', configuredApiKey);

    expect(Date.now() - startedAt).toBeLessThan(1000);
  });

  // SPEC-004/B2, SPEC-004/B3, SPEC-004/B4, SPEC-004/B8
  it('does not wait for an outcome other than slow', async () => {
    const recordingSleep = createRecordingSleep();

    await postQuote('success', configuredApiKey, recordingSleep.sleep);
    await postQuote('error', configuredApiKey, recordingSleep.sleep);
    await postQuote('badGateway', configuredApiKey, recordingSleep.sleep);
    await postQuote('timeout', configuredApiKey, recordingSleep.sleep);
    await postQuote('malformed', configuredApiKey, recordingSleep.sleep);

    expect(recordingSleep.calls).toEqual([]);
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
    const app = createApp({ pickOutcome: pickerAlwaysReturning('error'), sleep: instantSleep });

    const response = await app.request('/health');

    expect(response.status).toBe(200);
  });
});

// The real picker runs here. A double would leave this test proving nothing:
// it would stay green while the route hands the picker a rate it never read
// from the environment.
async function postQuoteWithRealPicker(apiKey: string) {
  const app = createApp({ pickOutcome, sleep: instantSleep });

  const response = await app.request('/commission-quote', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(validRequest),
  });

  return response.status;
}

// A route that reads the rate from config answers every one of these. A route
// holding any hard-coded nonzero rate instead — say 0.2 — fails about one in
// five, so a hundred requests catch it with a chance of about one in five
// billion of slipping through.
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
