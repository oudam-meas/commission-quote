import { serve } from '@hono/node-server';
import { app } from './app.js';
import { readConfig } from './config.js';

const defaultPort = 4000;
const port = process.env.PORT ? Number(process.env.PORT) : defaultPort;

// Fail at startup rather than on the first request, so a misconfigured mock is
// noticed by whoever started it.
try {
  readConfig(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`commission-quote-api-mock listening on http://localhost:${info.port}`);
});
