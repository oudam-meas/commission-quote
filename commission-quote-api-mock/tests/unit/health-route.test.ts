import { describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';

// The contract test only checks that a status field is present. The exact body
// is the mock's own promise, so it is checked here instead.
// SPEC-001/B2
describe('the health route', () => {
  it('answers a health check with ok', async () => {
    const response = await app.request('/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});
