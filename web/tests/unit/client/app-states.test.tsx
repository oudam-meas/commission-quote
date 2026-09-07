// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../../src/client/App';

// The three response fields ADR-001 fixes. None of them appear in the form, so a
// match on screen can only have come from a response.
const quote = { quoteId: 'a-quote-id', commissionRate: 0.0125, totalCommission: 62500 };

// The failure body ADR-004 fixes, with wording the client has never seen.
const vendorMessage = 'The quote service is not answering right now.';
const validationMessage = 'loanTermInMonths must be between 1 and 480.';

const firstRequestId = 'request-id-one';
const secondRequestId = 'request-id-two';

type PendingRequest = {
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
};

const pendingRequests: PendingRequest[] = [];
const originalFetch = globalThis.fetch;

// A hand-written console.warn that records what the app logs. The request id
// from a failure goes here rather than on screen.
const recordedWarnings: unknown[][] = [];
const originalWarn = console.warn;

// A hand-written fetch that never settles on its own. Each test says when the
// request finishes, which is what lets it assert on the state in between.
beforeEach(() => {
  pendingRequests.length = 0;
  recordedWarnings.length = 0;

  globalThis.fetch = () =>
    new Promise<Response>((resolve, reject) => {
      pendingRequests.push({ resolve, reject });
    });

  console.warn = (...loggedValues: unknown[]) => {
    recordedWarnings.push(loggedValues);
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  console.warn = originalWarn;
  cleanup();
});

// Everything console.warn received, flattened to one searchable string.
function everythingWarned() {
  return recordedWarnings.flat().join(' ');
}

function quoteResponse(requestId: string) {
  return new Response(JSON.stringify(quote), {
    status: 200,
    headers: { 'content-type': 'application/json', 'x-request-id': requestId },
  });
}

function failureResponse(message: string, requestId: string) {
  return new Response(JSON.stringify({ error: { code: 'VENDOR_UNAVAILABLE', message } }), {
    status: 502,
    headers: { 'content-type': 'application/json', 'x-request-id': requestId },
  });
}

function latestRequest() {
  const request = pendingRequests.at(-1);

  if (!request) {
    throw new Error('No quote request is in flight.');
  }

  return request;
}

// act lets React apply the state change before the next assertion runs.
async function respondWith(response: Response) {
  const request = latestRequest();

  await act(async () => {
    request.resolve(response);
  });
}

function submitControl(screen: RenderResult) {
  return screen.getByRole('button', { name: /get a quote/i }) as HTMLButtonElement;
}

function submitTheForm(screen: RenderResult) {
  fireEvent.change(screen.getByLabelText(/loan amount/i), { target: { value: '5000' } });
  fireEvent.change(screen.getByLabelText(/loan term/i), { target: { value: '24' } });
  fireEvent.change(screen.getByLabelText(/risk band/i), { target: { value: 'MEDIUM' } });
  fireEvent.click(submitControl(screen));
}

describe('the page while a quote request is in flight', () => {
  // SPEC-009/B1
  it('disables the submit control and shows a loading indicator', () => {
    const screen = render(<App />);

    submitTheForm(screen);

    expect(submitControl(screen).disabled).toBe(true);
    expect(screen.getByRole('status')).toBeDefined();
  });

  // SPEC-009/B4
  it('clears the previous message when the form is submitted again', async () => {
    const screen = render(<App />);

    submitTheForm(screen);
    await respondWith(failureResponse(vendorMessage, firstRequestId));
    expect(screen.getByText(vendorMessage)).toBeDefined();

    submitTheForm(screen);

    expect(screen.queryByText(vendorMessage)).toBeNull();
    expect(screen.getByRole('status')).toBeDefined();
  });
});

describe('the page after a quote request finishes', () => {
  // The id means nothing to the person reading the screen, so it goes to the
  // console where someone debugging can trace it through the server log.
  // SPEC-009/B3
  // SPEC-009/B5
  it('logs the request id from a failure and keeps it off screen', async () => {
    const screen = render(<App />);

    submitTheForm(screen);
    await respondWith(failureResponse(vendorMessage, firstRequestId));

    expect(screen.getByText(vendorMessage)).toBeDefined();
    expect(screen.queryByText(new RegExp(firstRequestId))).toBeNull();
    expect(everythingWarned()).toContain(firstRequestId);
  });

  // SPEC-009/B2
  it('replaces the quote on screen with the message when the next request fails', async () => {
    const screen = render(<App />);

    submitTheForm(screen);
    await respondWith(quoteResponse(firstRequestId));
    expect(screen.getByText(/a-quote-id/)).toBeDefined();

    submitTheForm(screen);
    await respondWith(failureResponse(validationMessage, secondRequestId));

    expect(screen.queryByText(/a-quote-id/)).toBeNull();
    expect(screen.getByText(validationMessage)).toBeDefined();
  });

  // A user holding a quote has nothing to report, so the header stays unshown
  // and unlogged.
  // SPEC-009/B7
  it('keeps the request id off screen and out of the console when a quote comes back', async () => {
    const screen = render(<App />);

    submitTheForm(screen);
    await respondWith(quoteResponse(firstRequestId));

    expect(screen.getByText(/a-quote-id/)).toBeDefined();
    expect(screen.queryByText(new RegExp(firstRequestId))).toBeNull();
    expect(everythingWarned()).not.toContain(firstRequestId);
  });

  // SPEC-009's Contract holds one fallback message for this case. Its exact
  // wording lives in the client, so this asserts a message reached the screen
  // with no request id beside it, and the page left the loading state.
  // SPEC-009/B6
  it('shows a message when the request never reaches the server', async () => {
    const screen = render(<App />);

    submitTheForm(screen);
    const request = latestRequest();
    await act(async () => {
      request.reject(new Error('Failed to fetch'));
    });

    expect(screen.getByRole('alert').textContent).toBeTruthy();
    expect(screen.queryByText(/request id/i)).toBeNull();
    expect(submitControl(screen).disabled).toBe(false);
  });
});
