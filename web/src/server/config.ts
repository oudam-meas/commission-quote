export type Config = {
  vendorUrl: string;
  vendorApiKey: string;
  port: number;
};

const defaultPort = 4001;

// The environment arrives as a parameter, following the mock's config module, so
// a test can describe a broken environment without changing the one it runs in.
export function readConfig(env: Record<string, string | undefined>): Config {
  const vendorUrl = env.VENDOR_URL;

  // Neither vendor value has a safe default. A server that starts without them
  // fails later, on a request, and blames the vendor for its own misconfiguration.
  if (!vendorUrl) {
    throw new Error('VENDOR_URL is not set. Copy .env.example to .env and set a value.');
  }

  const vendorApiKey = env.VENDOR_API_KEY;

  if (!vendorApiKey) {
    throw new Error('VENDOR_API_KEY is not set. Copy .env.example to .env and set a value.');
  }

  return { vendorUrl, vendorApiKey, port: readPort(env.PORT) };
}

function readPort(value: string | undefined): number {
  // Empty counts as absent, so a blank line in .env falls back to the default
  // instead of asking for port 0.
  if (!value) {
    return defaultPort;
  }

  return Number(value);
}
