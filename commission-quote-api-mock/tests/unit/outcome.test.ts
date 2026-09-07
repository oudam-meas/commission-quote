import { describe, expect, it } from 'vitest';
import { pickOutcome } from '../../src/outcome.js';

// pickOutcome takes its rate as an argument — it has no default of its own.
// This is just a representative rate, so the bands it describes stay
// readable next to the numbers.
const exampleFailureRate = 0.2;
const failureBandWidth = exampleFailureRate / 5;
// Each boundary adds one more band width to the last, the same way
// pickOutcome accumulates them — matching that order avoids a
// floating-point mismatch at the exact boundary.
const badGatewayBandStart = 1 - exampleFailureRate + failureBandWidth;
const timeoutBandStart = badGatewayBandStart + failureBandWidth;
const slowBandStart = timeoutBandStart + failureBandWidth;
const malformedBandStart = slowBandStart + failureBandWidth;

// The random number arrives as a parameter, so every band can be checked
// without waiting for chance to produce it.
// SPEC-004/B1
describe('picking an outcome from a random number', () => {
  it('succeeds just below the start of the error band', () => {
    expect(pickOutcome(0.79, exampleFailureRate)).toBe('success');
  });

  it('fails with an error exactly at the start of the error band', () => {
    expect(pickOutcome(0.8, exampleFailureRate)).toBe('error');
  });

  it('answers a bad gateway exactly at the start of that band', () => {
    expect(pickOutcome(badGatewayBandStart, exampleFailureRate)).toBe('badGateway');
  });

  it('times out exactly at the start of the timeout band', () => {
    expect(pickOutcome(timeoutBandStart, exampleFailureRate)).toBe('timeout');
  });

  it('answers slow exactly at the start of that band', () => {
    expect(pickOutcome(slowBandStart, exampleFailureRate)).toBe('slow');
  });

  it('answers malformed exactly at the start of that band', () => {
    expect(pickOutcome(malformedBandStart, exampleFailureRate)).toBe('malformed');
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
