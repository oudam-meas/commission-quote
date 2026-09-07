import { describe, expect, it, vi } from 'vitest';
import { processQuoteRequest } from '../../../src/server/services/quote-service.js';
import type { LoanDetails, Quote, VendorClient } from '../../../src/server/vendor/client.js';
import { VendorStatusError } from '../../../src/server/vendor/client.js';

const validLoanDetails: LoanDetails = {
  loanAmount: 25000000,
  loanTermInMonths: 240,
  riskBand: 'LOW',
};

const validQuote: Quote = {
  quoteId: 'a-quote-id',
  commissionRate: 0.015,
  totalCommission: 375000,
};

// Hand-written doubles, one outcome each. None touches a network, so no test
// here depends on the stand-in's random failures.
function vendorRaising(status: number): VendorClient {
  return {
    requestQuote: async () => {
      throw new VendorStatusError(status);
    },
  };
}

// Stands in for the vendor client's own deadline elapsing. The real client
// lets AbortSignal.timeout()'s DOMException propagate unchanged, so this
// double throws the same shape rather than a vendor-specific class.
const vendorTimingOut: VendorClient = {
  requestQuote: async () => {
    throw new DOMException('The operation was aborted.', 'TimeoutError');
  },
};

function vendorAnswering(quote: Quote): VendorClient {
  return {
    requestQuote: async () => quote,
  };
}

describe('processQuoteRequest, rejecting with an HTTPException built from a vendor answer', () => {
  // SPEC-008/B1
  it('rejects a vendor 5xx as a 502 vendor-error', async () => {
    await expect(processQuoteRequest(validLoanDetails, vendorRaising(500))).rejects.toMatchObject({
      status: 502,
      cause: { code: 'VENDOR_UNAVAILABLE' },
    });
  });

  // SPEC-008/B2
  it('rejects a vendor 401 as the same 502 response as a 5xx', async () => {
    await expect(processQuoteRequest(validLoanDetails, vendorRaising(401))).rejects.toMatchObject({
      status: 502,
      cause: { code: 'VENDOR_UNAVAILABLE' },
    });
  });

  // SPEC-008/B3
  it('rejects a vendor 504 as a 503 timeout', async () => {
    await expect(processQuoteRequest(validLoanDetails, vendorRaising(504))).rejects.toMatchObject({
      status: 503,
      cause: { code: 'VENDOR_TIMEOUT' },
    });
  });

  // SPEC-008/B4
  it("rejects the vendor client's own deadline elapsing as a 503 timeout, byte-identical to B3", async () => {
    await expect(processQuoteRequest(validLoanDetails, vendorTimingOut)).rejects.toMatchObject({
      status: 503,
      cause: { code: 'VENDOR_TIMEOUT' },
    });
  });

  // SPEC-008/B15
  // SPEC-008/B7
  it('rejects a 200 body that breaks the outbound contract as a 500 invalid-response, and logs the field', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      processQuoteRequest(validLoanDetails, vendorAnswering({ ...validQuote, commissionRate: 12 })),
    ).rejects.toMatchObject({
      status: 500,
      cause: { code: 'INVALID_RESPONSE' },
    });

    expect(errorSpy).toHaveBeenCalledWith(expect.any(String), ['commissionRate']);

    errorSpy.mockRestore();
  });

  // SPEC-008/B14
  it("logs a vendor status error's cause, without it reaching the thrown response", async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const vendorError = new VendorStatusError(500, { cause: 'at Object.<anonymous> (vendor.js:42)' });

    const raised = await processQuoteRequest(validLoanDetails, {
      requestQuote: async () => {
        throw vendorError;
      },
    }).catch((error: unknown) => error);

    expect(errorSpy).toHaveBeenCalledWith(vendorError);
    expect(raised).toMatchObject({ cause: { code: 'VENDOR_UNAVAILABLE' } });
    expect(JSON.stringify((raised as { cause: unknown }).cause)).not.toContain('vendor.js');

    errorSpy.mockRestore();
  });
});
