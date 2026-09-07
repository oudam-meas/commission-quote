// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { QuoteDisplay } from '../../../src/client/QuoteDisplay';

// Vitest globals are off, so the testing library cannot register this itself.
afterEach(cleanup);

// The three response fields ADR-001 fixes. totalCommission is in cents, which is
// what the vendor returns.
const quote = {
  quoteId: 'a-quote-id',
  commissionRate: 0.0125,
  totalCommission: 123456,
};

describe('the quote display', () => {
  // SPEC-006/B5
  it('shows the quote id', () => {
    const { getByText } = render(<QuoteDisplay quote={quote} />);

    expect(getByText(/a-quote-id/)).toBeDefined();
  });

  // No spec fixes how a rate is written, so a fraction and a percentage both
  // pass.
  // SPEC-006/B5
  it('shows the commission rate', () => {
    const { getByText } = render(<QuoteDisplay quote={quote} />);

    expect(getByText(/0\.0125|1\.25\s?%/)).toBeDefined();
  });

  // The vendor sends 123456 cents. No spec fixes the money format, so a currency
  // symbol and a thousands separator are both allowed, and the digits are what
  // matter.
  // SPEC-006/B5
  // SPEC-006/B7
  it('shows the total commission in dollars', () => {
    const { getByText } = render(<QuoteDisplay quote={quote} />);

    expect(getByText(/\$?1,?234\.56/)).toBeDefined();
  });

  it('renders nothing when there is no quote', () => {
    const { container } = render(<QuoteDisplay quote={null} />);

    expect(container.firstChild).toBeNull();
  });
});
