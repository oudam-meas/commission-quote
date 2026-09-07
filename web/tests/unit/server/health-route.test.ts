import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/server/app.js';

// The vendor client goes in through the constructor, so even a route that never
// reaches the vendor is built with one. This double answers nothing, because the
// health check asks it nothing.
const vendorClientDouble = {
  requestQuote: async () => {
    throw new Error('The health check must not reach the vendor.');
  },
};

// The app is built without binding a port, so this runs in process.
// SPEC-005/B2
describe('the health route', () => {
  it('answers a health check with ok', async () => {
    const app = createApp({ vendorClient: vendorClientDouble });

    const response = await app.request('/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});
