export type Outcome = 'success' | 'error' | 'timeout';

// The random number arrives as a parameter, so a test can pin any outcome
// without an env var and without waiting for chance. The pick itself stays
// uncontrollable at runtime.
export function pickOutcome(randomNumber: number, failureRate: number): Outcome {
  const errorBandStart = 1 - failureRate;

  // The failure share splits evenly between error and timeout, so the timeout
  // band is the last half of it. Measuring back from 1 keeps the default rate
  // landing on exactly 0.9, which adding two fractions would not.
  const timeoutBandStart = 1 - failureRate / 2;

  if (randomNumber < errorBandStart) {
    return 'success';
  }

  if (randomNumber < timeoutBandStart) {
    return 'error';
  }

  return 'timeout';
}
