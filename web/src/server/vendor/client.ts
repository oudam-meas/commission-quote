import type { LoanDetails, Quote, VendorClient, VendorClientDependencies } from '../types.js';

export type { LoanDetails, Quote, VendorClient, VendorClientDependencies } from '../types.js';

// Arbitrary. Held here rather than the route, so production code is not
// shaped around a test double's limits.
const vendorDeadlineMs = 3000;

// Raised when the vendor answers with anything other than 200. It carries the
// status for the route to sort by, and the raw body as `cause` — for the log
// only. Nothing parses it, nothing sends it anywhere near the browser.
export class VendorStatusError extends Error {
  readonly status: number;

  constructor(status: number, options?: { cause?: unknown }) {
    super(`The vendor answered ${status}.`, options);
    this.name = 'VendorStatusError';
    this.status = status;
  }
}

// This module is the only place that knows the vendor exists. The path and
// the key live here and nowhere else.
export function createVendorClient(dependencies: VendorClientDependencies): VendorClient {
  const quoteUrl = `${dependencies.vendorUrl}/commission-quote`;

  return {
    requestQuote: async (loanDetails: LoanDetails): Promise<Quote> => {
      // AbortSignal.timeout() rejects fetch with a DOMException named
      // TimeoutError once the deadline elapses. That propagates unchanged —
      // processQuoteRequest is the one place that recognises it.
      const response = await dependencies.fetch(quoteUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'api-key': dependencies.vendorApiKey,
        },
        body: JSON.stringify(loanDetails),
        signal: AbortSignal.timeout(vendorDeadlineMs),
      });

      if (response.status !== 200) {
        throw new VendorStatusError(response.status, { cause: await response.text() });
      }

      return (await response.json()) as Quote;
    },
  };
}
