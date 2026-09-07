import type { Context, Next } from 'hono';
import { readConfig } from '../config.js';

export type AppVariables = { failureRate: number };

const unauthorized = {
  error: { code: 'UNAUTHORIZED', message: 'Missing or invalid api-key' },
};

// Reads config once per request, so a changed key or rate takes effect
// without a restart. The key is checked before the body, so a wrong key is
// a 401 even when the body is garbage. Lives on this route alone — /health
// is a liveness check and takes no key.
export async function authMiddleware(
  context: Context<{ Variables: AppVariables }>,
  next: Next,
) {
  const { apiKey, failureRate } = readConfig(process.env);

  if (context.req.header('api-key') !== apiKey) {
    return context.json(unauthorized, 401);
  }

  context.set('failureRate', failureRate);
  await next();
}
