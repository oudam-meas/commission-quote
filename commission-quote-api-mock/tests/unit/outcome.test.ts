import { describe, expect, it } from 'vitest';
import { pickOutcome } from '../../src/outcome.js';

// The rate the mock runs on by default. Every band test below passes it
// explicitly, so the bands it describes stay readable next to the numbers.
const defaultFailureRate = 0.2;

// The random number arrives as a parameter, so every band can be checked
// without waiting for chance to produce it.
// SPEC-004/B1
describe('picking an outcome from a random number', () => {
  it('succeeds just below the start of the error band', () => {
    expect(pickOutcome(0.79, defaultFailureRate)).toBe('success');
  });

  it('fails with an error exactly at the start of the error band', () => {
    expect(pickOutcome(0.8, defaultFailureRate)).toBe('error');
  });

  it('times out exactly at the start of the timeout band', () => {
    expect(pickOutcome(0.9, defaultFailureRate)).toBe('timeout');
  });
});

// SPEC-004/B7
describe('picking an outcome at the ends of the rate', () => {
  it('succeeds on the highest number the range can hold when the rate is zero', () => {
    expect(pickOutcome(0.99, 0)).toBe('success');
  });

  it('fails on the lowest number the range can hold when everything is set to fail', () => {
    expect(pickOutcome(0, 1)).toBe('error');
  });
});
