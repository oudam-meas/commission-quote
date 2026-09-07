import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/server/app.js';
import type { LoanDetails, VendorClient } from '../../src/server/vendor/client.js';
import { VendorStatusError } from '../../src/server/vendor/client.js';

const loanDetails: LoanDetails = {
  loanAmount: 25000000,
  loanTermInMonths: 240,
  riskBand: 'LOW',
};

const vendorUnavailable = 'Service unavailable. Please try again. This is a simulated vendor failure.';

type ErrorEnvelope = { error: { code: string; message: string } };

// A hand-written double. It never touches a network, so this test does not
// depend on the stand-in's random failures.
function vendorRaising(status: number): VendorClient {
  return {
    requestQuote: async () => {
      throw new VendorStatusError(status);
    },
  };
}

// Stands in for a bug rather than a vendor failure: something that is not
// one of the categories the route knows how to sort.
const vendorThrowingUnexpectedly: VendorClient = {
  requestQuote: async () => {
    throw new Error('boom');
  },
};

function postQuote(vendorClient: VendorClient) {
  return createApp({ vendorClient }).request('/api/quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(loanDetails),
  });
}

// A 5xx and a 4xx, not the full B1-B7 matrix — SPEC-008 covers that in
// web/tests/unit/server/quote-service.test.ts, against processQuoteRequest
// directly. What is left to prove here is that the route wires a service
// outcome to an actual response on the wire, and that the two vendor
// statuses genuinely produce the same bytes, not just the same category.
describe('what the browser gets when the vendor fails', () => {
  // SPEC-008/B1
  it('answers 502 when the vendor returns a server error', async () => {
    const response = await postQuote(vendorRaising(500));
    const body = (await response.json()) as ErrorEnvelope;

    expect(response.status).toBe(502);
    expect(body.error.code).toBe('VENDOR_UNAVAILABLE');
    expect(body.error.message).toBe(vendorUnavailable);
  });

  // SPEC-008/B2
  it('answers the same 502 when the vendor rejects our api-key', async () => {
    const response = await postQuote(vendorRaising(401));
    const body = (await response.json()) as ErrorEnvelope;

    expect(response.status).toBe(502);
    expect(body.error.code).toBe('VENDOR_UNAVAILABLE');
    expect(body.error.message).toBe(vendorUnavailable);
  });

  // SPEC-008/B12
  // SPEC-008/B13
  // Exercises app.onError, the app's error boundary: the only place that
  // decides what an unrecognised thrown value becomes on the wire, and the
  // only place anything about it is logged.
  it('answers 500 with a generic message when something other than a vendor failure is thrown, and logs the raw error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await postQuote(vendorThrowingUnexpectedly);
    const body = (await response.json()) as ErrorEnvelope;

    expect(response.status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('Something went wrong. Please try again.');
    expect(body.error.message).not.toBe('boom');
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }));

    errorSpy.mockRestore();
  });
});
