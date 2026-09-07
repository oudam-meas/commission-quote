import { describe, expect, it } from 'vitest';
import { readConfig } from '../../../src/server/config.js';

// The environment arrives as a parameter, following the mock's config module, so
// a test can describe a broken environment without changing the one it runs in.
const completeEnvironment = {
  VENDOR_URL: 'http://localhost:4000',
  VENDOR_API_KEY: 'local-dev-key',
  PORT: '4100',
};

describe('reading the server configuration', () => {
  // SPEC-006/B2
  it('takes the vendor url, the vendor api key and the port from the environment', () => {
    expect(readConfig(completeEnvironment)).toEqual({
      vendorUrl: 'http://localhost:4000',
      vendorApiKey: 'local-dev-key',
      port: 4100,
    });
  });

  // SPEC-006/B2
  it('refuses an environment with no vendor url, naming the variable', () => {
    const environment = { ...completeEnvironment, VENDOR_URL: undefined };

    expect(() => readConfig(environment)).toThrow(/VENDOR_URL/);
  });

  // SPEC-006/B2
  it('refuses an environment with no vendor api key, naming the variable', () => {
    const environment = { ...completeEnvironment, VENDOR_API_KEY: undefined };

    expect(() => readConfig(environment)).toThrow(/VENDOR_API_KEY/);
  });

  // The port keeps the safe default SPEC-005 gave it. SPEC-006 moves the lookup
  // into this module so one place reads the environment.
  // SPEC-005/B1
  it('falls back to port 4001 when the port is not set', () => {
    const environment = { ...completeEnvironment, PORT: undefined };

    expect(readConfig(environment).port).toBe(4001);
  });
});
