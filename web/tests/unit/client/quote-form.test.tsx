// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { QuoteForm } from '../../../src/client/QuoteForm';

// Vitest globals are off, so the testing library cannot register this itself.
afterEach(cleanup);

type LoanDetails = {
  loanAmount: number;
  loanTermInMonths: number;
  riskBand: string;
};

// A hand-written stand-in for the handler the parent passes down. The component
// stays pure, so this is the only way to see what it submitted.
function createSubmitRecorder() {
  const submitted: LoanDetails[] = [];

  return {
    submitted,
    onSubmit: (details: LoanDetails) => {
      submitted.push(details);
    },
  };
}

describe('the quote form', () => {
  // The amount is typed in dollars and handed on in cents, so this covers the
  // form's half of B6 as well.
  // SPEC-006/B4
  // SPEC-006/B6
  it('hands the three loan details to its submit handler', () => {
    const recorder = createSubmitRecorder();
    const { getByLabelText, getByRole } = render(<QuoteForm onSubmit={recorder.onSubmit} />);

    fireEvent.change(getByLabelText(/loan amount/i), { target: { value: '5000' } });
    fireEvent.change(getByLabelText(/loan term/i), { target: { value: '24' } });
    fireEvent.change(getByLabelText(/risk band/i), { target: { value: 'MEDIUM' } });
    fireEvent.click(getByRole('button'));

    expect(recorder.submitted).toEqual([
      { loanAmount: 500000, loanTermInMonths: 24, riskBand: 'MEDIUM' },
    ]);
  });

  // The risk band select always holds a value, so the two text fields are the
  // whole condition.
  // SPEC-009/B8
  it('disables the submit control until both text fields hold a value', () => {
    const recorder = createSubmitRecorder();
    const { getByLabelText, getByRole } = render(<QuoteForm onSubmit={recorder.onSubmit} />);
    const control = getByRole('button') as HTMLButtonElement;

    expect(control.disabled).toBe(true);

    fireEvent.change(getByLabelText(/loan amount/i), { target: { value: '5000' } });
    expect(control.disabled).toBe(true);

    fireEvent.change(getByLabelText(/loan term/i), { target: { value: '24' } });
    expect(control.disabled).toBe(false);
  });

  // SPEC-009/B8
  it('disables the submit control again when a filled field is emptied', () => {
    const recorder = createSubmitRecorder();
    const { getByLabelText, getByRole } = render(<QuoteForm onSubmit={recorder.onSubmit} />);
    const control = getByRole('button') as HTMLButtonElement;

    fireEvent.change(getByLabelText(/loan amount/i), { target: { value: '5000' } });
    fireEvent.change(getByLabelText(/loan term/i), { target: { value: '24' } });
    expect(control.disabled).toBe(false);

    fireEvent.change(getByLabelText(/loan amount/i), { target: { value: '' } });
    expect(control.disabled).toBe(true);
  });

});
