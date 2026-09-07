import { HTTPException } from 'hono/http-exception';
import type { LoanDetails } from '../types.js';
import type { VendorClient } from '../vendor/client.js';
import { VendorStatusError } from '../vendor/client.js';
import { validateQuote } from './validation.js';

// The vendor is a stand-in for this project (see ADR-001) — every failure it
// raises today is the mock's own simulated one, never a real vendor problem.
// The note goes away with the stand-in itself, when a real vendor exists to
// fail for real reasons.
const simulatedNote = 'This is a simulated vendor failure.';
const vendorUnavailableMessage = `Service unavailable. Please try again. ${simulatedNote}`;
const vendorTimeoutMessage = `The quote service did not answer in time. Please try again. ${simulatedNote}`;

function vendorTimeoutError(): HTTPException {
  return new HTTPException(503, {
    cause: { code: 'VENDOR_TIMEOUT', message: vendorTimeoutMessage },
  });
}

function vendorUnavailableError(): HTTPException {
  return new HTTPException(502, {
    cause: { code: 'VENDOR_UNAVAILABLE', message: vendorUnavailableMessage },
  });
}

function invalidResponseError(): HTTPException {
  return new HTTPException(500, {
    cause: { code: 'INVALID_RESPONSE', message: vendorUnavailableMessage },
  });
}

// Calls the vendor and validates what it answered. Throws HTTPException the
// moment a failure is known; the route does no classifying of its own.
// Inbound validation already ran in validateQuoteRequest — loanDetails here
// is already valid.
export async function processQuoteRequest(
  loanDetails: LoanDetails,
  vendorClient: VendorClient,
): Promise<{ quoteId: string; commissionRate: number; totalCommission: number }> {
  let vendorResponse: unknown;
  try {
    vendorResponse = await vendorClient.requestQuote(loanDetails);
  } catch (raised) {
    // AbortSignal.timeout() rejects with a DOMException named TimeoutError.
    // The vendor client lets it propagate unchanged; this is the one place
    // that recognises it.
    if (raised instanceof DOMException && raised.name === 'TimeoutError') {
      throw vendorTimeoutError();
    }

    if (raised instanceof VendorStatusError) {
      console.error(raised);

      // 504 is also a 5xx, so it is matched before the catch-all below.
      if (raised.status === 504) {
        throw vendorTimeoutError();
      }

      throw vendorUnavailableError();
    }

    throw raised;
  }

  const response = validateQuote(vendorResponse);
  if (!response.valid) {
    console.error('invalid vendor response', response.fieldNames);
    throw invalidResponseError();
  }

  return {
    quoteId: response.data.quoteId,
    commissionRate: response.data.commissionRate,
    totalCommission: response.data.totalCommission,
  };
}
