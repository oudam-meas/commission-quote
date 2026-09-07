import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorBody, healthBody, quoteBody } from './schemas.js';

// This suite is a blackbox. It imports nothing from the mock's own app
// logic — only the shared contract schemas, which state the agreement
// rather than the stand-in's implementation of it — and it talks over a
// real port, so the same file can be pointed at the real vendor.
const vendorUrl = process.env.VENDOR_URL ?? 'http://localhost:4000';
const vendorApiKey = process.env.VENDOR_API_KEY ?? 'local-dev-key';

// The three request fields ADR-001 fixes. riskBand LOW is one of the bands
// SPEC-003 prices; a band with no rate would answer 400.
const quoteRequest = {
  loanAmount: 250000,
  loanTermInMonths: 240,
  riskBand: 'LOW',
};

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
  // This suite needs the vendor's random failure turned off — run it against
  // a server started with FAILURE_RATE=0, or this row fails one time in
  // five. SPEC-004's failure paths are covered by unit tests with a
  // hand-written double instead; a contract test cannot force one deliberately.
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
      const response = await sendRequest(entry);

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
