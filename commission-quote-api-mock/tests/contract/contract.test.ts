import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// This suite is a blackbox. It imports nothing from the mock it tests, and it
// talks over a real port, so the same file can be pointed at the real vendor.
// zod is a schema library on the test side, so importing it keeps that
// property.
const vendorUrl = process.env.VENDOR_URL ?? 'http://localhost:4000';
const vendorApiKey = process.env.VENDOR_API_KEY ?? 'local-dev-key';

// The three request fields ADR-001 fixes. riskBand LOW is one of the bands
// SPEC-003 prices; a band with no rate would answer 400.
const quoteRequest = {
  loanAmount: 250000,
  loanTermInMonths: 240,
  riskBand: 'LOW',
};

// Every schema below states shape and constraint and never a value, because a
// correct vendor implementation nobody here has seen has to pass this file
// unedited. z.object ignores keys it does not name, so a vendor that returns
// more fields than we agreed stays green.

const healthBody = z.object({
  status: z.string().min(1),
});

// One envelope for every error the contract covers, per ADR-001.
const errorBody = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

// A rate is a fraction, so it sits between 0 and 1. Money is whole cents, so
// totalCommission is an integer and cannot be owed backwards.
const quoteBody = z.object({
  quoteId: z.string().min(1),
  commissionRate: z.number().gt(0).lt(1),
  totalCommission: z.number().int().nonnegative(),
});

type ContractRow = {
  name: string;
  request: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
  expect: {
    status: number;
    body: z.ZodType;
    contentType?: string;
  };
  // How many times the row may ask before it gives up. A row that leaves this
  // out sends one request, which is what every row did before SPEC-004.
  maxAttempts?: number;
};

// SPEC-001/B3: the rows are walked by a real fetch against VENDOR_URL, in a
// command of its own, against an already-running process.
const contract: ContractRow[] = [
  // SPEC-001/B1, SPEC-001/B2
  {
    name: 'answers the health check with 200 and a JSON body carrying a status field',
    request: { method: 'GET', path: '/health' },
    expect: { status: 200, body: healthBody, contentType: 'application/json' },
  },
  // SPEC-002/B4: the api-key check must not spread to /health.
  {
    name: 'answers the health check when no api-key is sent',
    request: { method: 'GET', path: '/health' },
    expect: { status: 200, body: healthBody },
  },
  // SPEC-002/B1
  {
    name: 'rejects a quote request with no api-key header',
    request: {
      method: 'POST',
      path: '/commission-quote',
      headers: { 'content-type': 'application/json' },
      body: quoteRequest,
    },
    expect: { status: 401, body: errorBody },
  },
  // SPEC-002/B1
  {
    name: 'rejects a quote request whose api-key header is empty',
    request: {
      method: 'POST',
      path: '/commission-quote',
      headers: { 'content-type': 'application/json', 'api-key': '' },
      body: quoteRequest,
    },
    expect: { status: 401, body: errorBody },
  },
  // SPEC-002/B2
  {
    name: 'rejects a quote request with an api-key that does not match',
    request: {
      method: 'POST',
      path: '/commission-quote',
      headers: { 'content-type': 'application/json', 'api-key': 'not-the-configured-key' },
      body: quoteRequest,
    },
    expect: { status: 401, body: errorBody },
  },
  // The vendor fails a share of its quote requests on purpose, so this row asks
  // again until it is answered. Five attempts miss about once in three thousand
  // runs. The 401 rows need none of this: SPEC-004/B5 puts the api-key check
  // before the pick, so they are already settled.
  // SPEC-002/B3
  {
    name: 'returns the quote fields for a request carrying the configured api-key',
    request: {
      method: 'POST',
      path: '/commission-quote',
      headers: { 'content-type': 'application/json', 'api-key': vendorApiKey },
      body: quoteRequest,
    },
    expect: { status: 200, body: quoteBody },
    maxAttempts: 5,
  },
];

function sendRequest(entry: ContractRow) {
  return fetch(`${vendorUrl}${entry.request.path}`, {
    method: entry.request.method,
    headers: entry.request.headers,
    body: entry.request.body === undefined ? undefined : JSON.stringify(entry.request.body),
  });
}

describe('Commission Quote API contract', () => {
  for (const entry of contract) {
    it(entry.name, async () => {
      const maxAttempts = entry.maxAttempts ?? 1;
      let response = await sendRequest(entry);
      let attempts = 1;

      while (response.status !== entry.expect.status && attempts < maxAttempts) {
        response = await sendRequest(entry);
        attempts += 1;
      }

      expect(response.status).toBe(entry.expect.status);

      if (entry.expect.contentType !== undefined) {
        expect(response.headers.get('content-type')).toContain(entry.expect.contentType);
      }

      const parsed = entry.expect.body.safeParse(await response.json());

      // Comparing the readable error against an empty string puts the mismatch
      // in the assertion diff, so a red row names the field that broke.
      expect(parsed.success ? '' : z.prettifyError(parsed.error)).toBe('');
    });
  }
});
