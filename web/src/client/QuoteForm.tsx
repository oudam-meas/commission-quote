import { type SubmitEvent, useState } from 'react';
import { dollarsToCents } from './money/cents';
import type { QuoteFormProps } from './types';

const riskBands = ['LOW', 'MEDIUM', 'HIGH'];

export function QuoteForm({ onSubmit, disabled = false }: QuoteFormProps) {
  const [loanAmountInDollars, setLoanAmountInDollars] = useState('');
  const [loanTermInMonths, setLoanTermInMonths] = useState('');
  const [riskBand, setRiskBand] = useState('LOW');

  // The risk band select always holds a value, so the two text fields are the
  // whole condition.
  const hasEmptyField = loanAmountInDollars === '' || loanTermInMonths === '';
  const hasNonPositiveValue = Number(loanAmountInDollars) <= 0 || Number(loanTermInMonths) <= 0;

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    onSubmit({
      loanAmount: dollarsToCents(Number(loanAmountInDollars)),
      loanTermInMonths: Number(loanTermInMonths),
      riskBand,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="loanAmount">Loan amount in dollars</label>
        <input
          id="loanAmount"
          type="number"
          min="1"
          step="1"
          value={loanAmountInDollars}
          onChange={(event) => setLoanAmountInDollars(event.target.value)}
        />
      </div>

      <div>
        <label htmlFor="loanTermInMonths">Loan term in months</label>
        <input
          id="loanTermInMonths"
          type="number"
          min="1"
          step="1"
          value={loanTermInMonths}
          onChange={(event) => setLoanTermInMonths(event.target.value)}
        />
      </div>

      <div>
        <label htmlFor="riskBand">Risk band</label>
        <select
          id="riskBand"
          value={riskBand}
          onChange={(event) => setRiskBand(event.target.value)}
        >
          {riskBands.map((band) => (
            <option key={band} value={band}>
              {band}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" disabled={disabled || hasEmptyField || hasNonPositiveValue}>
        Get a quote
      </button>
    </form>
  );
}
