# ADR-004: Error handling in the app

**Status:** Accepted
**Date:** 2026-09-07

## Context

The vendor fails on purpose. The brief asks for proper loading states and
error messages, and asks what happens when the user submits invalid
numbers. Those are two different kinds of failure and shouldn't look the
same on screen.

## Decision

`api` sorts every failure into one of a few categories, never reacting to
a specific error or to text in a body. That keeps the mapping small, and
keeps the tests small too, since one double per category proves it.

| What happened | Status to the browser | `code` |
|---|---|---|
| Vendor 5xx, a 4xx we caused, or a vendor auth failure (401/403) | `502` | `VENDOR_UNAVAILABLE` |
| Vendor `504`, or `api`'s own deadline elapsing first | `503` | `VENDOR_TIMEOUT` |
| Vendor `200`, but the body breaks the outbound contract | `500` | `INVALID_RESPONSE` |
| The request itself was rejected, before the vendor was called | `400` | `INVALID_REQUEST` |
| Anything else — a bug, not a vendor failure | `500` | `INTERNAL_ERROR` |
| Request body over 10,000 bytes, on any route | `413` | `PAYLOAD_TOO_LARGE` |

A vendor auth failure gets the same `502` as any other vendor error,
because the user can't do anything differently for one than the other,
and a `401` back to the browser would suggest their own session expired.

`503`, not `504`, covers `api`'s own timeout, because a gateway in front
of `api` can also answer `504` when it gives up on us. Reusing that
status for our own vendor timeout would make the two indistinguishable
from outside.

`api` runs no timer of its own for this. The stand-in always answers,
even with an error — the one failure it can't produce is silence, a
vendor that never answers at all. That case is covered by
`vendor/client.ts`'s own deadline instead (ADR-003), and `api` just reacts
to whatever the outbound call settles as: a status code, or a thrown
timeout with none. A `504` and a vendor that never answered land in the
same category, because there's nothing the user can do differently for
either.

The user sees one plain message per category. Status codes and vendor
detail go to the logs, not the screen. Validation errors are the
exception: they name the field to fix, because that's something the user
can act on and a vendor error isn't.

`api` validates both directions, against the contract in ADR-001, because
it's the trust boundary.

Inbound, before the vendor is called: a request that can't produce a
quote never leaves the building. Reject at the first bad field, name
that field, make no vendor call.

| Field | Rule |
|---|---|
| `loanAmount` | integer cents, `100_000` to `1_000_000_000` — $1,000 to $10m |
| `loanTermInMonths` | integer, `1` to `480` |
| `riskBand` | exactly `LOW`, `MEDIUM` or `HIGH` |

These bounds are ours. The brief fixes none, and the vendor ignores
`loanTermInMonths` entirely, so mirroring it would give no rule at all.

Outbound, on the way back: the vendor's response gets checked against the
same contract before anything is shown. Validating a reply we asked for
looks paranoid, but the vendor is a system we don't own, still under
construction, and the stand-in is my own guess at it. A `commissionRate`
of `12` or a missing `quoteId` should surface as a vendor problem rather
than a broken screen, and the log line is what tells the vendor team
which field. Both directions use the same schemas, written once and read
in both places — the reason for `zod` in `web`.

Every failure shares one body shape:

```json
{ "error": { "code": "VENDOR_UNAVAILABLE", "message": "…" } }
```

An unexpected error — a bug, not a vendor failure — gets the same shape,
with a generic message. The user was never meant to see that error's own
text; it wasn't written for them and may carry detail we don't control.
The raw error goes to the log, never to the response body.

The request id comes back as an `x-request-id` header on every response,
success included, so a client reads it the same way whatever happened
and the success body stays just the three vendor fields.

## Logging

Log at the boundary only: the incoming request, the outgoing vendor call,
and the outcome. A request id generated at the edge goes on the log line
and comes back in the response, so a failed quote can be traced from what
the user saw to what the vendor did. Never log the api-key or a full
vendor response body.

## Consequences

- Integration tests: one per category, with the vendor client swapped for
  a double.
- The vendor client's own deadline is tested separately, at the unit
  level, because an integration double replaces the whole client and a
  deadline inside it would never fire against one.
- UI components take the mapped message as a prop, so a unit test covers
  the error state without a network.
- Adding a new vendor error later means adding a category, not another
  branch in the code.
