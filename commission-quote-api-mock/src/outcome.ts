export type Outcome = 'success' | 'error' | 'badGateway' | 'timeout' | 'slow' | 'malformed';

// The random number arrives as a parameter, so a test can pin any outcome
// without an env var and without waiting for chance. The pick itself stays
// uncontrollable at runtime.
export function pickOutcome(randomNumber: number, failureRate: number): Outcome {
  const successBandStart = 1 - failureRate;

  // The failure share splits evenly across the five failure kinds.
  const failureBandWidth = failureRate / 5;
  const badGatewayBandStart = successBandStart + failureBandWidth;
  const timeoutBandStart = badGatewayBandStart + failureBandWidth;
  const slowBandStart = timeoutBandStart + failureBandWidth;
  const malformedBandStart = slowBandStart + failureBandWidth;

  if (randomNumber < successBandStart) {
    return 'success';
  }

  if (randomNumber < badGatewayBandStart) {
    return 'error';
  }

  if (randomNumber < timeoutBandStart) {
    return 'badGateway';
  }

  if (randomNumber < slowBandStart) {
    return 'timeout';
  }

  if (randomNumber < malformedBandStart) {
    return 'slow';
  }

  return 'malformed';
}
