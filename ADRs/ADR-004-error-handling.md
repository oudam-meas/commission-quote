# ADR-004: Error handling in the app

**Status:** Accepted
**Date:** 2026-09-05

## Context

The vendor fails on purpose. The brief asks for proper loading states and error
messages. It also asks what happens when the user submits invalid numbers.

Those are two different kinds of failure. They should not look the same on
screen.

## Decision

### Sort by category, not by individual error

From the vendor:

- 5xx — vendor error
- 401 or 403 — vendor auth failure. The user sees the same message as a 5xx,
  but there is no point retrying this one
- 504 — the vendor did not answer in time

Before the vendor:

- 4xx — `api` rejected the request itself. It never reached the vendor

`api` reacts to the category. It never reacts to a specific error or to text in
the body. This keeps the mapping small. It also keeps the tests small, because
one double per category is enough to prove the mapping.

### `api` runs no timer of its own

The stand-in always answers, even when the answer is an error. The one
failure it cannot produce is silence — a vendor that never answers at all.

That case is covered, but not by `api`. `vendor/client.ts` holds its own
deadline; ADR-003 holds why. `api` just reacts to what the outbound call
settles as: a status code, or a thrown timeout with none. A vendor `504`
and a vendor that never answered get the same category and the same
response — there is nothing the user can do differently for one than the
other.

### The user sees a message, not a status code

One plain message for each category. Status codes and vendor detail go to the
logs.

Validation errors are the exception. They name the field the user needs to fix.
A vendor error cannot do that, because there is nothing the user can do about
it.

### `api` validates both directions

`api` is the trust boundary. It checks what comes in from the browser and
what comes back from the vendor, against the contract in ADR-001.

**Inbound, before the vendor is called.** A request that cannot produce a
quote never leaves the building. Fail fast: reject at the first bad field,
name that field, and make no vendor call. This is the brief's "what happens
if the user submits invalid numbers", and it is a `400`.

The bounds are ours. The brief fixes none, and the vendor ignores
`loanTermInMonths` entirely, so mirroring it would give no rule at all.

| Field | Rule |
|---|---|
| `loanAmount` | integer cents, `100_000` to `1_000_000_000` — $1,000 to $10m |
| `loanTermInMonths` | integer, `1` to `480` |
| `riskBand` | exactly `LOW`, `MEDIUM` or `HIGH` |

**Outbound, on the way back.** The vendor's response is checked against the
same contract before anything is shown. A response that fails is a vendor
error: the user sees the vendor-error message, the log records what was
wrong.

Validating a reply we asked for looks paranoid. It is not. The vendor is a
system we do not own, still under construction, and the stand-in is my own
guess at it. A `commissionRate` of `12` or a missing `quoteId` should surface
as a vendor problem rather than as a broken screen, and the log line is what
tells the vendor team which.

Both directions use the same schemas, so the contract is written once and
read in both places. That is the reason for `zod` in `web`.

### What the browser actually receives

I left this open too long. Writing the specs showed both were blocked on it.

| Category | Status |
|---|---|
| Vendor 5xx, or a 4xx we caused | `502` |
| Vendor auth failure | `502` |
| Vendor 504, or our own deadline elapsing | `503` |
| We rejected the request | `400` |

`502` for a vendor auth failure because the user sees the same message as
any vendor error. Nothing they can do differs, and a `401` to the browser
would suggest their own session had expired.

`503`, not `504`, for our own timeout category. A gateway in front of us
can also answer `504` when *it* gives up on us — reusing that status for
our own vendor timeout would make the two indistinguishable from outside.

### An error nothing here anticipated

A bug, not a vendor failure, can still throw. The user should not see that
error's own message — it was never written for them, and it may carry detail
we do not control.

Anything thrown that is not one of the categories above answers `500` with
one generic message, the same shape as every other failure:

| Category | Status | `code` | Message |
|---|---|---|---|
| unexpected | `500` | `INTERNAL_ERROR` | `Something went wrong. Please try again.` |

The raw error goes to the log, never to the response body.

The failure body is the shape the stand-in already uses, so one error shape
covers the whole system:

```json
{ "error": { "code": "VENDOR_UNAVAILABLE", "message": "…" } }
```

Codes: `VENDOR_UNAVAILABLE`, `VENDOR_TIMEOUT`, `INVALID_REQUEST`.

The request id comes back as an `x-request-id` header on every response,
success included. A header rather than a body field, so the success body
stays the three vendor fields and a client reads the id the same way
whatever happened.

### Logging

Log at the boundary only. The incoming request, the outgoing vendor call, and
the outcome.

A request ID is generated at the edge. It goes on the log line and comes back
in the response. That way a failed quote can be traced from what the user saw
to what the vendor did.

Never log the api-key. Never log a full vendor response body.

## Consequences

- Integration tests: one per category, with the vendor client swapped for a
  double.
- The vendor client's own deadline is tested separately, at the unit level —
  an integration double replaces the whole client, so a deadline inside it
  never fires against one.
- UI components take the mapped message as a prop. A unit test can then cover
  the error state without a network.
- Adding a new vendor error later means adding a category, not another branch
  in the code.
