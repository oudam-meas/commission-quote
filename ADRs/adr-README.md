# ADRs

Decisions and why. One file each. A number can still move while the work
behind it is unbuilt — ADR-004 was ADR-003 until the first slice needed that
number. Once code depends on a number, it stays.

What the brief fixes — the vendor contract — is in
[ADR-001](ADR-001-vendor-stand-in.md), under Context. It is not repeated
here. One copy, in the ADR that owns it.

## Decisions already made

Flat statements. Don't re-litigate these — if one needs changing, change it
here first and say so.

- Money is integer cents. Never float. `loanAmount` arrives in cents and
  `totalCommission` is returned in cents.
- `riskBand` is `LOW`, `MEDIUM` or `HIGH`, invented for the stand-in. SPEC-003 holds the
  rates. An unrecognised band is a `400`.
- The api-key never reaches the browser. `src/server/` holds it.
- `api` reads a vendor error body as raw text, for the log only — never
  parsed, never forwarded to the browser. It still sorts purely on the
  vendor's status code. SPEC-008 holds why.
- The mock's rate is fixed per risk band, not random.
- Randomness is for failure simulation only. One source of non-determinism.
- The failure pick takes its random number as an argument, so a unit test can
  pin every outcome without an env var.
- `api` answers the browser `502`, `503` or `400` by category, in the same
  error envelope the stand-in uses. The request id comes back as an
  `x-request-id` header. ADR-004 holds the table.
- The vendor client, not `api`, holds the deadline that protects our own
  resources from a vendor that never answers. ADR-003 holds why.
- `api` validates both directions against ADR-001's contract. Bad input is
  rejected before any vendor call; a vendor response that fails the contract
  is a vendor error. ADR-004 holds the bounds.
- The mock is hand-rolled. No Pact, no WireMock, no Prism.
- The contract test reads `VENDOR_URL`. Shape and status only, never values.
- Three test levels: unit, integration (vendor double), contract.
- Hand-written doubles. No mocking libraries.
- The mock imports nothing from `web/`, and the other way round.

## Still open

Don't decide these. If a decision needs one, stop and ask.

- (nothing right now)
- Rate versioning, quote persistence, unrecognised riskBand behaviour —
  these go to the vendor team, not into an ADR

## How to write one

- Say what the brief says. Not what I'd expect at org scale, not domain
  background. That's conversation, not a file.
- First person. "I built a stand-in", not "a stand-in was built".
- No epigraphs. No four-column tables. They read as generated.
- Short sentences. Some blunt.
- If it hedges, cut it.
- Under 700 words. If it's longer, it's covering two decisions.

## Format

```
# ADR-00N: Title

**Status:** Accepted
**Date:** YYYY-MM-DD

## Context
## Decision
## Consequences
```

## Index

| # | Title | Produces | Specs |
|---|---|---|---|
| 001 | The vendor stand-in | The stand-in and its contract suite | [001](../specs/001-vendor-mock-bootstrap.md), [002](../specs/002-vendor-mock-auth-and-stub.md), [003](../specs/003-vendor-mock-pricing.md), [004](../specs/004-vendor-mock-failures.md) |
| 002 | Project setup and the web/mock boundary | The `web` package and its boundary | [005](../specs/005-web-scaffold.md) |
| 003 | The first slice and how it runs | Quote form, quote endpoint, dev double, root scripts | [006](../specs/006-web-quote-slice.md), [007](../specs/007-run-modes.md) |
| 004 | Error handling in the app | Validation both ways, mapped categories, UI states | [008](../specs/008-api-error-categories.md), [009](../specs/009-client-loading-and-error-states.md) |

A spec belongs to the ADR that made it necessary. It may cite others —
almost everything cites ADR-001, because ADR-001 holds the contract. The
full map, including what is built, is in
[the spec index](../specs/spec-README.md).
