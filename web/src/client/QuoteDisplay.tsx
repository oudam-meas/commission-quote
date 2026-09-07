import { centsToDollars } from './money/cents';
import type { Quote } from './types';

type QuoteDisplayProps = {
  quote: Quote | null;
};

// The vendor sends a rate as a fraction and a total in cents. Both are turned
// into what a person reads here, at the edge, so no other module carries two
// units for the same number.
export function QuoteDisplay({ quote }: QuoteDisplayProps) {
  if (!quote) {
    return null;
  }

  return (
    <dl>
      <dt>Quote id</dt>
      <dd>{quote.quoteId}</dd>

      <dt>Commission rate</dt>
      <dd>{(quote.commissionRate * 100).toFixed(2)}%</dd>

      <dt>Total commission</dt>
      <dd>${centsToDollars(quote.totalCommission).toFixed(2)}</dd>
    </dl>
  );
}
