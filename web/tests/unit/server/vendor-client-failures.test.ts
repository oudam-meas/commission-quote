import { describe, expect, it } from 'vitest';
import { VendorStatusError, createVendorClient } from '../../../src/server/vendor/client.js';

const vendorUrl = 'http://localhost:4000';
const vendorApiKey = 'local-dev-key';

const loanDetails = {
  loanAmount: 25000000,
  loanTermInMonths: 240,
  riskBand: 'LOW',
};

// A hand-written stand-in for fetch. It answers with the status the test asks
// for, so nothing here needs a network.
function createFetchDouble(status: number, body = JSON.stringify({ error: { code: 'VENDOR_FAULT', message: 'x' } })) {
  const fetchDouble = async (): Promise<Response> => {
    return new Response(body, {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };

  return { fetch: fetchDouble };
}

function buildClient(fetchDouble: ReturnType<typeof createFetchDouble>) {
  return createVendorClient({ fetch: fetchDouble.fetch, vendorUrl, vendorApiKey });
}

describe('the vendor client when the vendor does not answer 200', () => {
  // SPEC-008/B1
  it('raises the vendor status for the route to sort', async () => {
    const client = buildClient(createFetchDouble(500));

    await expect(client.requestQuote(loanDetails)).rejects.toBeInstanceOf(VendorStatusError);
  });

  // SPEC-008/B1
  it('carries the status the vendor answered with', async () => {
    const client = buildClient(createFetchDouble(503));

    const error = await client.requestQuote(loanDetails).catch((raised: unknown) => raised);

    expect((error as VendorStatusError).status).toBe(503);
  });

  // SPEC-008/B14
  it('carries the raw body as cause, unparsed, for the log', async () => {
    const client = buildClient(createFetchDouble(500, 'at Object.<anonymous> (vendor.js:42)'));

    const error = await client.requestQuote(loanDetails).catch((raised: unknown) => raised);

    expect((error as VendorStatusError).cause).toBe('at Object.<anonymous> (vendor.js:42)');
  });
});

// A fetch double that mirrors AbortSignal.timeout()-driven fetch: it never
// settles on its own, only when the signal it was handed aborts, and it
// rejects with the same DOMException fetch itself throws in that case.
function createNeverRespondingFetch() {
  const fetchDouble = (...args: Parameters<typeof fetch>): Promise<Response> => {
    const [, init] = args;
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'TimeoutError'));
      });
    });
  };

  return { fetch: fetchDouble };
}

describe("the vendor client's own deadline", () => {
  // SPEC-008/B4
  // This waits out the real 3-second deadline `vendor/client.ts` holds via
  // AbortSignal.timeout(). That duration is not injectable, so a double that
  // never resolves until the real abort fires is the only way to reach it.
  it(
    "lets AbortSignal.timeout()'s DOMException propagate once the deadline elapses",
    async () => {
      const client = createVendorClient({ ...createNeverRespondingFetch(), vendorUrl, vendorApiKey });

      await expect(client.requestQuote(loanDetails)).rejects.toMatchObject({ name: 'TimeoutError' });
    },
    { timeout: 5000 },
  );
});
