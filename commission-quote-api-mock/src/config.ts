export type Config = {
  apiKey: string;
  failureRate: number;
};

const defaultFailureRate = 0.2;

// The environment arrives as a parameter so a test can describe a broken
// environment without changing the one it runs in.
export function readConfig(env: Record<string, string | undefined>): Config {
  const apiKey = env.API_KEY;

  // API_KEY has no default. A stand-in that accepts any key when misconfigured
  // is worse than one that refuses to boot.
  if (!apiKey) {
    throw new Error('API_KEY is not set. Copy .env.example to .env and set a value.');
  }

  return { apiKey, failureRate: readFailureRate(env.FAILURE_RATE) };
}

function readFailureRate(value: string | undefined): number {
  // Empty counts as absent, the same way the API_KEY check treats it. Number('')
  // is 0, so converting first would switch failures off without saying so.
  if (!value) {
    return defaultFailureRate;
  }

  const failureRate = Number(value);

  if (Number.isNaN(failureRate) || failureRate < 0 || failureRate > 1) {
    throw new Error(`FAILURE_RATE must be a number between 0 and 1. Got "${value}".`);
  }

  return failureRate;
}
