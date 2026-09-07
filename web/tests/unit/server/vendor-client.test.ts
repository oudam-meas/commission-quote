import { describe, expect, it } from 'vitest';
import { createVendorClient } from '../../../src/server/vendor/client.js';

const vendorUrl = 'http://localhost:4000';
const vendorApiKey = 'local-dev-key';

// The loan amount is in cents, which is what the vendor takes.
const loanDetails = {
  loanAmount: 25000000,
  loanTermInMonths: 240,
  riskBand: 'LOW',
};

const vendorQuote = {
  quoteId: 'a-quote-id',
  commissionRate: 0.015,
  totalCommission: 375000,
};

type FetchCall = {
  url: string;
  method: string | undefined;
  apiKey: string | null;
  body: unknown;
};

// A hand-written stand-in for fetch. It records the four things B3 names and
// always answers, so this test needs no network and cannot fail at random. fetch
// arrives as a dependency, so no global is replaced.
function createFetchDouble() {
  const calls: FetchCall[] = [];

  const fetchDouble = async (
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const options = init ?? {};

    calls.push({
      url: String(url),
      method: options.method,
      // Reading through Headers accepts a plain object and a Headers instance
      // alike, so the test sees what was sent without pinning how it was built.
      apiKey: new Headers(options.headers).get('api-key'),
      body: typeof options.body === 'string' ? JSON.parse(options.body) : options.body,
    });

    return new Response(JSON.stringify(vendorQuote), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  return { calls, fetch: fetchDouble };
}

function callVendor(fetchDouble: ReturnType<typeof createFetchDouble>) {
  const client = createVendorClient({
    fetch: fetchDouble.fetch,
    vendorUrl,
    vendorApiKey,
  });

  return client.requestQuote(loanDetails);
}

describe('the vendor client', () => {
  // SPEC-006/B3
  it('posts the loan details to the vendor quote endpoint', async () => {
    const fetchDouble = createFetchDouble();

    await callVendor(fetchDouble);
    const [call] = fetchDouble.calls;

    expect(fetchDouble.calls).toHaveLength(1);
    expect(call?.url).toBe('http://localhost:4000/commission-quote');
    expect(call?.method).toBe('POST');
    expect(call?.body).toEqual(loanDetails);
  });

  // SPEC-006/B3
  it('sends the configured api-key as a header', async () => {
    const fetchDouble = createFetchDouble();

    await callVendor(fetchDouble);
    const [call] = fetchDouble.calls;

    expect(call?.apiKey).toBe(vendorApiKey);
  });

  // SPEC-006/B3
  it('returns the quote the vendor answered with', async () => {
    const quote = await callVendor(createFetchDouble());

    expect(quote).toEqual(vendorQuote);
  });
});
