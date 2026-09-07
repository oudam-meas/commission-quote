import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { requestId as requestIdMiddleware } from 'hono/request-id';
import type { ErrorResponse } from './errors/error-response.js';
import { bodyLimitMiddleware } from './middleware/body-limit.js';
import { validateQuoteRequest } from './middleware/validate-quote-request.js';
import type { AppVariables } from './middleware/validate-quote-request.js';
import { processQuoteRequest } from './services/quote-service.js';
import type { AppDependencies } from './types.js';

export function createApp({ vendorClient }: AppDependencies): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();

  app.use('*', logger());
  app.use('*', bodyLimitMiddleware());
  app.use('*', requestIdMiddleware());

  app.get('/health', (context) => {
    return context.json({ status: 'ok' });
  });

  app.post('/api/quote', validateQuoteRequest, async (context) => {
    const requestBody = context.get('requestBody');

    const response = await processQuoteRequest(requestBody, vendorClient);
    return context.json(response);
  });

  app.onError((raised, context) => {
    if (raised instanceof HTTPException && raised.cause) {
      return context.json({ error: raised.cause as ErrorResponse }, raised.status);
    }

    // A bare string would print unescaped — newlines and ANSI codes would
    // run as-is. Wrapping forces the same escaping an Error already gets.
    console.error(typeof raised === 'string' ? { raised } : raised);

    return context.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } },
      500,
    );
  });

  return app;
}
