export type Config = {
  apiKey: string;
  failureRate: number;
};

const defaultFailureRate = 0;

export function readConfig(env: Record<string, string | undefined>): Config {
  const apiKey = env.API_KEY;

  if (!apiKey) {
    throw new Error('API_KEY is not set. Copy .env.example to .env and set a value.');
  }

  return { apiKey, failureRate: readFailureRate(env.FAILURE_RATE) };
}

function readFailureRate(value: string | undefined): number {
  if (!value) {
    return defaultFailureRate;
  }

  const failureRate = Number(value);

  if (Number.isNaN(failureRate) || failureRate < 0 || failureRate > 1) {
    throw new Error(`FAILURE_RATE must be a number between 0 and 1. Got "${value}".`);
  }

  return failureRate;
}
