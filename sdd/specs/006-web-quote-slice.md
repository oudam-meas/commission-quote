---
id: SPEC-006
title: Web — the quote slice, happy path
status: done
primary_test_level: integration
touches: [web/src/, web/tests/]
---

## Intent

One thin slice through the whole app. A form takes loan details, the
server asks the vendor, the numbers come back on screen. Happy path
only.

## Behaviours

- B1: `POST /api/quote` sends the loan details to the vendor and returns
  the vendor's quote.
- B2: `src/server/config.ts` raises when `VENDOR_URL` or
  `VENDOR_API_KEY` is unset, naming the variable.
- B3: The vendor client posts to `VENDOR_URL` with the `api-key` header.
- B4: The form captures `loanAmount`, `loanTermInMonths` and `riskBand`.
- B5: Submitting the form shows the returned quote.
- B6: Dollars typed by the user are converted to integer cents before
  the request.
- B7: Cents returned by the vendor are formatted as dollars on screen.
- B8: No file under `src/client/` contains `VENDOR_URL` or the api-key.
- B9: The submit control is disabled unless the loan amount and the
  loan term are both valid, non-zero numbers.
- B10: Both inputs carry `min`, `max` and `step="1"`, so the browser
  refuses to submit a negative value, one with decimal places, or one
  above the server's cap — `10000000` dollars for the amount, `480`
  months for the term.

## Contract

| | |
|---|---|
| Endpoint | `POST /api/quote` |
| Request | `loanAmount`, `loanTermInMonths`, `riskBand` |
| Response | `quoteId`, `commissionRate`, `totalCommission` |

**Files**

| Path | Holds |
|---|---|
| `src/server/vendor/client.ts` | the only file with `VENDOR_URL`, the `api-key` header and the vendor's response shape |
| `src/server/config.ts` | reads `PORT`, `VENDOR_URL`, `VENDOR_API_KEY`. Raises on the last two |
| `src/client/money/cents.ts` | dollars to cents, cents to dollars |
| `src/client/useQuote.ts` | the only file that calls `fetch` |

**Seams**

- `createApp` takes the vendor client as an argument.
- `createVendorClient` takes `fetch` as an argument.

**Cents**

`loanAmount` is sent in integer cents. `totalCommission` returns in
integer cents. The server passes both through untouched and never
rounds.

**Components**

Pure. State and handlers arrive as props. `useQuote` holds the state.

**Dependencies**

`jsdom`, `@testing-library/react`.

## Verification

| Behaviour | Level | How |
|---|---|---|
| B1 | integration | the endpoint, vendor client doubled |
| B2 | unit | call config with each variable missing |
| B3 | unit | vendor client with a `fetch` double; assert URL, header, body |
| B4 | unit | render the form, assert the three fields |
| B5 | unit | render the display with a quote |
| B6 | unit | dollars to cents, both edges |
| B7 | unit | cents to dollars, both edges |
| B8 | human | `grep -r VENDOR_URL web/src/client/` returns nothing |
| B9 | unit | set the loan amount (or the term) to `0`, a negative value, or empty; assert submit stays disabled. Set both to valid positive values; assert it's enabled |
| B10 | unit | render the form, assert `min`/`max`/`step` on each input |
| B10's submit block | human | type a negative, decimal or over-max amount, click submit, confirm nothing reaches the network tab |

Doubles are hand-written.

## Main session owns

- `web/package.json` — the two new dependencies
- `web/.env.example` — `VENDOR_URL`, `VENDOR_API_KEY`
- `web/README.md` — the vendor variables and how to start against the mock

## Edge cases

| Condition | Expected |
|---|---|
| Vendor returns a quote | `200`, fields passed through |
| `VENDOR_URL` or `VENDOR_API_KEY` unset | exits non-zero, names the variable |
| Form submitted before a response arrives | out of scope |
| The loan amount or the loan term is zero, negative, or empty | the submit control stays disabled. B9 |
| A negative or a decimal amount is typed, then submitted | `min`/`step` never block the keystroke, only the native submit event. B10 |

### Not handled

- Every failure path: vendor `500`, `504`, `401`, the outbound timeout.
- Loading states.
- Validating what the user typed, beyond B9's non-zero check and B10's
  `min`/`step`.
- The dev double and run modes.
- Styling beyond making the form legible.

## Open questions

- (none)

---

## Rationale

**The browser-facing endpoint reuses the vendor's field names** rather
than inventing a second vocabulary. One less mapping to keep in step.

**`fetch` is passed into the vendor client** because it is the one
module that makes a network call and the one place the api-key is
attached. Passing it in means a hand-written double proves the URL, the
header and the body with no network. Reaching for the global would pin
the module to it and leave B3 unprovable without a live server.

**`money/cents.ts` sits in `src/client/`.** ADR-002's tree
puts it under the server. Dollars only exist in the client, and
`tsconfig.client.json` covers only `src/client`. Recorded because it
departs from the ADR's sketch.

**Converting once, at the client edge**, keeps the server from rounding
at all. Rounding twice is how money goes wrong.

**`jsdom` and `@testing-library/react` arrive here** because B4 and B5
render components. SPEC-005 rendered to a string, which can show markup
but never a click. SPEC-005 deferred the choice to the first spec that
needed a DOM.

**No contract test in this spec.** The mock's suite already covers the
real HTTP call.

**B9 checks the parsed value, on every render, rather than the
earlier `min`/`step` attributes or an `onChange` keystroke guard.**
Both of those tried to police individual keystrokes, and both ran into
the same wall: a browser's native `type="number"` input reports `''`
to `onChange` for any text that doesn't parse as a number yet (a lone
`-`, for instance), even while still showing that text on screen. A
keystroke guard that trusts `onChange`'s reported value can't tell
that apart from an intentionally empty field, so a rejected keystroke
can still visibly linger — typing `-` twice in a row could leave `--`
on screen despite every individual `onChange` call being turned away.
Disabling submit from the parsed value instead sidesteps the whole
problem: the field always shows exactly what the user typed, and
`Number(value) > 0` decides whether that's good enough to submit.
ADR-004's real bounds — 1 to 480, $1,000 to $10m — still stay
server-side; this only stops the empty/zero/negative case.

**No decimal-place check in B9 itself.** `10000.256` still passes B9
— it's a positive number. B10's `min`/`step` catches that case
instead.

**B10 brings `min`/`step` back, but only as a native submit-time
constraint, not an `onChange` keystroke guard.** The earlier `--` bug
came from intercepting `onChange` and conditionally calling
`setState` — the browser reports `''` for text that doesn't parse yet,
so a rejected keystroke could still visibly linger. B10 does no
interception at all: both inputs set state directly from whatever was
typed, and `min`/`step` only decide whether the browser's native
submit event fires. `min="1"` gives the loan amount a fixed step base,
so `step="1"` rejects any decimal amount at submit time the same way
it already rejected a negative one — the field now takes whole dollars
only. `1` is an arbitrary floor; the brief fixes no minimum loan
amount, and `1` was picked to match the loan term's own floor rather
than `0`, which would have let a `0`-dollar loan sit one keystroke
away from valid.

**Whole dollars is a UI-only rule.** `api` (`contracts.ts`) is
unchanged and still accepts a fractional dollar amount — `100_050`
cents, i.e. $1,000.50, still passes `loanAmount: z.number().int()...`
because that's a whole number of *cents*, and `api` never checks
whether it's also a whole number of dollars. B10 only narrows what
this one form lets a user type; a request built outside it is not
this behaviour's concern.
