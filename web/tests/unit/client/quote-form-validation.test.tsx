// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { QuoteForm } from '../../../src/client/QuoteForm';

// Vitest globals are off, so the testing library cannot register this itself.
afterEach(cleanup);

describe('the quote form', () => {
  // SPEC-006/B9
  it('disables the submit control when the loan amount is zero', () => {
    const { getByLabelText, getByRole } = render(<QuoteForm onSubmit={() => {}} />);
    const control = getByRole('button') as HTMLButtonElement;

    fireEvent.change(getByLabelText(/loan term/i), { target: { value: '24' } });
    fireEvent.change(getByLabelText(/loan amount/i), { target: { value: '0' } });

    expect(control.disabled).toBe(true);
  });

  // SPEC-006/B9
  it('disables the submit control when the loan amount is negative', () => {
    const { getByLabelText, getByRole } = render(<QuoteForm onSubmit={() => {}} />);
    const control = getByRole('button') as HTMLButtonElement;

    fireEvent.change(getByLabelText(/loan term/i), { target: { value: '24' } });
    fireEvent.change(getByLabelText(/loan amount/i), { target: { value: '-500' } });

    expect(control.disabled).toBe(true);
  });

  // SPEC-006/B9
  it('disables the submit control when the loan term is zero', () => {
    const { getByLabelText, getByRole } = render(<QuoteForm onSubmit={() => {}} />);
    const control = getByRole('button') as HTMLButtonElement;

    fireEvent.change(getByLabelText(/loan amount/i), { target: { value: '5000' } });
    fireEvent.change(getByLabelText(/loan term/i), { target: { value: '0' } });

    expect(control.disabled).toBe(true);
  });

  // SPEC-006/B9
  it('enables the submit control when both fields hold valid, non-zero numbers', () => {
    const { getByLabelText, getByRole } = render(<QuoteForm onSubmit={() => {}} />);
    const control = getByRole('button') as HTMLButtonElement;

    fireEvent.change(getByLabelText(/loan amount/i), { target: { value: '5000' } });
    fireEvent.change(getByLabelText(/loan term/i), { target: { value: '24' } });

    expect(control.disabled).toBe(false);
  });

  // SPEC-006/B10
  it('bounds the loan amount input to whole dollars from 1 to 10000000', () => {
    const { getByLabelText } = render(<QuoteForm onSubmit={() => {}} />);
    const input = getByLabelText(/loan amount/i) as HTMLInputElement;

    expect(input.min).toBe('1');
    expect(input.max).toBe('10000000');
    expect(input.step).toBe('1');
  });

  // SPEC-006/B10
  it('bounds the loan term input to whole months from 1 to 480', () => {
    const { getByLabelText } = render(<QuoteForm onSubmit={() => {}} />);
    const input = getByLabelText(/loan term/i) as HTMLInputElement;

    expect(input.min).toBe('1');
    expect(input.max).toBe('480');
    expect(input.step).toBe('1');
  });
});
