import { describe, expect, it } from 'vitest';
import { readConfig } from '../../src/config.js';

// The env arrives as a parameter, so a test can describe a broken environment
// without changing the one it runs in.
// SPEC-002/B5
describe('reading the server config', () => {
  it('raises and names the variable when the api key is missing', () => {
    expect(() => readConfig({})).toThrow(/API_KEY/);
  });
});

// Every case here sets a valid API_KEY, so the api-key check never decides the
// result and the failure rate is the only thing under test.
// SPEC-004/B7
describe('reading the failure rate from the config', () => {
  it('falls back to the default rate when the variable is absent', () => {
    expect(readConfig({ API_KEY: 'local-dev-key' }).failureRate).toBe(0);
  });

  // Number('') is also 0, so this and the absent case would pass even if the
  // empty check were missing entirely. It stays as its own case because the
  // reasoning — an explicit absent check, not a numeric coincidence — is what
  // this test is proving, not just the resulting number.
  it('falls back to the default rate when the variable is empty', () => {
    expect(readConfig({ API_KEY: 'local-dev-key', FAILURE_RATE: '' }).failureRate).toBe(0);
  });

  // Not a number rather than out of range: Number('often') is NaN, and every
  // comparison against NaN is false, so a range check alone would let it pass.
  it('raises and names the variable when the rate is not a number', () => {
    expect(() => readConfig({ API_KEY: 'local-dev-key', FAILURE_RATE: 'often' })).toThrow(
      /FAILURE_RATE/,
    );
  });
});
