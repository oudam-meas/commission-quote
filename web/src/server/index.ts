import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { createVendorClient } from './vendor/client.js';

// Config is read here, at the start, so a missing vendor value stops the process
// before it binds a port.
const config = readConfig(process.env);

const vendorClient = createVendorClient({
  fetch,
  vendorUrl: config.vendorUrl,
  vendorApiKey: config.vendorApiKey,
});

const app = createApp({ vendorClient });

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`web server listening on http://localhost:${info.port}`);
});
