import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { commissionQuoteRequestSchema } from '../contract/schemas.js';
import { type AppVariables, authMiddleware } from './middleware/auth-middleware.js';
import { type Outcome, pickOutcome } from './outcome.js';
import { rateForRiskBand, totalCommissionInCents } from './pricing.js';

const vendorError = {
  error: { code: 'VENDOR_ERROR', message: 'The quote service failed' },
};

const vendorBadGateway = {
  error: { code: 'VENDOR_BAD_GATEWAY', message: 'The quote service is temporarily unavailable' },
};

const vendorTimeout = {
  error: { code: 'VENDOR_TIMEOUT', message: 'The quote service did not answer in time' },
};

// 2000ms past the deadline api's vendor client holds (3000ms, in
// web/src/server/vendor/client.ts). Not imported — the two packages stay
// separate — but the number has to clear that deadline with room to
// spare, or a "slow" pick would never actually reach the client's own
// AbortSignal.timeout().
const slowDelayMs = 5000;

export type AppDependencies = {
  pickOutcome: (randomNumber: number, failureRate: number) => Outcome;
  sleep: (ms: number) => Promise<void>;
};

// The picker and the sleep both go in through the constructor, so the seam
// stays visible in the code and a test can pin an outcome without waiting out
// a real delay.
export function createApp(dependencies: AppDependencies): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();

  app.use(logger());
  app.get('/health', (context) => {
    return context.json({ status: 'ok' });
  });

  app.post('/commission-quote', authMiddleware, async (context) => {
    const failureRate = context.get('failureRate');

    const rawBody: unknown = await context.req.json().catch(() => undefined);

    const parsed = commissionQuoteRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return context.json(
        { error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]!.message } },
        400,
      );
    }

    const { loanAmount, riskBand } = parsed.data;
    const commissionRate = rateForRiskBand(riskBand);

    // Simulate a vendor failure, if the configured failure rate says to.
    // FAILURE_RATE is a number from 0 to 1, the chance a quote request fails.
    const outcome = dependencies.pickOutcome(Math.random(), failureRate);

    if (outcome === 'error') {
      return context.json(vendorError, 500);
    }

    if (outcome === 'badGateway') {
      return context.json(vendorBadGateway, 502);
    }

    if (outcome === 'timeout') {
      return context.json(vendorTimeout, 504);
    }

    if (outcome === 'malformed') {
      return context.json({
        quoteId: randomUUID(),
        commissionRate: 12,
        totalCommission: totalCommissionInCents(loanAmount, commissionRate),
      });
    }

    const quote = {
      quoteId: randomUUID(),
      commissionRate,
      totalCommission: totalCommissionInCents(loanAmount, commissionRate),
    };

    if (outcome === 'slow') {
      await dependencies.sleep(slowDelayMs);
    }

    return context.json(quote);
  });

  return app;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const app = createApp({ pickOutcome, sleep });
