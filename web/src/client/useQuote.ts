import { useState } from 'react';
import type { LoanDetails, Quote } from './types';

// No code field on purpose: reading it would duplicate the server's category
// mapping, and the two would drift apart.
type FailureBody = {
  error: { message: string };
};

const REQUEST_NEVER_ARRIVED = 'The quote request could not be sent. Please try again.';

function logRequestIdForDebugging(response: Response) {
  console.warn(response.headers.get('x-request-id'));
}

export function useQuote() {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function resetForNewRequest() {
    setQuote(null);
    setMessage(null);
    setIsLoading(true);
  }

  async function requestQuote(loanDetails: LoanDetails) {
    resetForNewRequest();

    try {
      const response = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(loanDetails),
      });
      const body = await response.json();

      if (response.ok) {
        setQuote(body as Quote);
      } else {
        logRequestIdForDebugging(response);
        setMessage((body as FailureBody).error.message);
      }
    } catch {
      setMessage(REQUEST_NEVER_ARRIVED);
    } finally {
      setIsLoading(false);
    }
  }

  return { quote, message, isLoading, requestQuote };
}
