// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../../src/client/App';

// What the user types. The amount is in dollars.
const typedLoanAmount = '5000';
const typedLoanTerm = '24';
const typedRiskBand = 'MEDIUM';

// What the server answers. None of these numbers appear in the form, so a match
// on screen can only have come from the response.
const quote = {
  quoteId: 'a-quote-id',
  commissionRate: 0.0125,
  totalCommission: 62500,
};

type FetchCall = {
  url: string;
  body: unknown;
};

const calls: FetchCall[] = [];
const originalFetch = globalThis.fetch;

// The browser's fetch is replaced rather than passed in. It has one
// implementation for the life of this app — ADR-003 keeps the client on one
// relative url in both run modes — so a seam here would have no second caller.
// The component tree is what this test is about; the fetching is scenery.
beforeEach(() => {
  calls.length = 0;

  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const options = init ?? {};

    calls.push({
      url: String(url),
      body: typeof options.body === 'string' ? JSON.parse(options.body) : options.body,
    });

    return new Response(JSON.stringify(quote), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  cleanup();
});

function renderAppAndSubmitTheForm() {
  const screen = render(<App />);

  fireEvent.change(screen.getByLabelText(/loan amount/i), {
    target: { value: typedLoanAmount },
  });
  fireEvent.change(screen.getByLabelText(/loan term/i), {
    target: { value: typedLoanTerm },
  });
  fireEvent.change(screen.getByLabelText(/risk band/i), {
    target: { value: typedRiskBand },
  });
  fireEvent.click(screen.getByRole('button'));

  return screen;
}

describe('submitting the quote form', () => {
  // SPEC-006/B4
  // SPEC-006/B6
  it('sends the loan details to the quote endpoint', async () => {
    renderAppAndSubmitTheForm();
    const [call] = calls;

    expect(calls).toHaveLength(1);
    expect(call?.url).toBe('/api/quote');
    expect(call?.body).toEqual({
      loanAmount: 500000,
      loanTermInMonths: 24,
      riskBand: 'MEDIUM',
    });
  });

  // SPEC-006/B5
  // SPEC-006/B7
  it('shows the quote that comes back', async () => {
    const screen = renderAppAndSubmitTheForm();

    expect(await screen.findByText(/a-quote-id/)).toBeDefined();
    // No spec fixes the money format, so a currency symbol and a thousands
    // separator are both allowed and the digits are what matter.
    expect(await screen.findByText(/\$?625\.00/)).toBeDefined();
  });
});
