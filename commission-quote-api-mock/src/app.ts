import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { readConfig } from './config.js';
import { type Outcome, pickOutcome } from './outcome.js';
import { rateForRiskBand, totalCommissionInCents } from './pricing.js';

const unauthorized = {
  error: { code: 'UNAUTHORIZED', message: 'Missing or invalid api-key' },
};

const vendorError = {
  error: { code: 'VENDOR_ERROR', message: 'The quote service failed' },
};

const vendorTimeout = {
  error: { code: 'VENDOR_TIMEOUT', message: 'The quote service did not answer in time' },
};

const unreadableBody = {
  error: { code: 'INVALID_REQUEST', message: 'A JSON request body is required' },
};

const invalidRiskBand = {
  error: { code: 'INVALID_REQUEST', message: 'riskBand must be LOW, MEDIUM or HIGH' },
};

const invalidLoanAmount = {
  error: {
    code: 'INVALID_REQUEST',
    message: 'loanAmount must be a positive whole number of cents',
  },
};

export type AppDependencies = {
  pickOutcome: (randomNumber: number, failureRate: number) => Outcome;
};

// The picker goes in through the constructor, so the seam stays visible in
// the code and a test can pin an outcome.
export function createApp(dependencies: AppDependencies): Hono {
  const app = new Hono();

  app.use(logger());
  app.get('/health', (context) => {
    return context.json({ status: 'ok' });
  });

  // The api-key check lives on this route alone. /health is a liveness check and
  // takes no key.
  app.post('/commission-quote', async (context) => {
    // Read per request so the value can change after this module is imported.
    const { apiKey, failureRate } = readConfig(process.env);

    // The key is checked before the body, so a wrong key is a 401 even when the
    // body is garbage.
    if (context.req.header('api-key') !== apiKey) {
      return context.json(unauthorized, 401);
    }

    let body: Record<string, unknown>;

    // json() throws when the body is absent or not valid JSON. There is nothing
    // to price in that case.
    try {
      body = await context.req.json();
    } catch {
      return context.json(unreadableBody, 400);
    }

    const loanAmount = body.loanAmount;

    // Checked here so pricing never receives an amount it cannot multiply. The
    // mock validates nothing else: loanTermInMonths changes no rate.
    if (typeof loanAmount !== 'number' || !Number.isInteger(loanAmount) || loanAmount <= 0) {
      return context.json(invalidLoanAmount, 400);
    }

    const riskBand = body.riskBand;

    if (typeof riskBand !== 'string') {
      return context.json(invalidRiskBand, 400);
    }

    const commissionRate = rateForRiskBand(riskBand);

    if (commissionRate === undefined) {
      return context.json(invalidRiskBand, 400);
    }

    // The pick comes after validation. A malformed request is the caller's
    // fault, so it must answer the same way every time. Math.random() is called
    // here and nowhere else, so randomness enters in one place.
    const outcome = dependencies.pickOutcome(Math.random(), failureRate);

    if (outcome === 'error') {
      return context.json(vendorError, 500);
    }

    // The 504 comes back straight away. The status category is what matters,
    // and the caller sets its own deadline.
    if (outcome === 'timeout') {
      return context.json(vendorTimeout, 504);
    }

    // A fresh id per response. An identifier that repeats is not an identifier.
    return context.json({
      quoteId: randomUUID(),
      commissionRate,
      totalCommission: totalCommissionInCents(loanAmount, commissionRate),
    });
  });

  return app;
}

// The app is kept apart from the listener so tests can call routes in process,
// without binding a port. This one picks at random, which is what the server
// runs.
export const app = createApp({ pickOutcome });
