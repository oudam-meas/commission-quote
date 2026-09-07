---
id: SPEC-003
title: Vendor mock — risk band pricing
status: done
primary_test_level: unit
touches: [commission-quote-api-mock/]
---

## Intent

Replace SPEC-002's fixed stub with a real calculation. A risk band maps
to a commission rate, the rate multiplies the loan amount, and the
result rounds to whole cents. Failures stay out — SPEC-004.

## Behaviours

- B1: Each risk band maps to its own fixed commission rate.
- B2: `totalCommission` is the loan amount times the rate, rounded to
  the nearest cent.
- B3: Each response carries a `quoteId` that differs between requests.
- B4: An unrecognised or missing `riskBand` returns `400`.
- B5: A `loanAmount` that is not a positive integer returns `400`.

## Contract

**Risk bands and rates.**

| `riskBand` | Rate |
|---|---|
| `LOW` | `0.015` |
| `MEDIUM` | `0.0125` |
| `HIGH` | `0.01` |

The brief fixes no band values and no rates. Both are invented here.
ADR-001 says the stand-in exists to satisfy the contract, so the numbers
only have to be plausible and fixed. `LOW`, `MEDIUM`, `HIGH` because three bands
is enough to show a mapping, and any real scheme would be the vendor's
to define.

**Money is integer cents, in and out.** `loanAmount` arrives in cents
and `totalCommission` is returned in cents. Never a float, per
`CLAUDE.md`'s invariant. The caller converts for display.

**The calculation.**

```
totalCommission = Math.round(loanAmount * rateFor(riskBand))
```

`Math.round` because the rate produces a fraction of a cent and a cent
is the smallest unit we return. This is the only place rounding happens.

**`quoteId`.** A UUID from Node's `crypto.randomUUID()`. No dependency.

This is a second source of randomness, and ADR-001 says one is enough.
The deviation is deliberate: that rule exists to keep pricing
deterministic, and an identifier that repeats across requests is not an
identifier. Pricing stays fixed.

`200` body:
```json
{
  "quoteId": "3f2a…",
  "commissionRate": 0.015,
  "totalCommission": 3750
}
```

`400` body, same envelope as SPEC-002's `401`:
```json
{ "error": { "code": "INVALID_REQUEST", "message": "riskBand must be LOW, MEDIUM or HIGH" } }
```

**Validation is only what pricing needs.** ADR-004 puts request
validation on `api`, before the vendor is called. The mock rejects a
`riskBand` it cannot price and a `loanAmount` it cannot multiply,
because otherwise it would return `NaN`. It checks nothing else —
`loanTermInMonths` is accepted and ignored, since no rate depends on it.

**Dependencies** — `zod`, for the request schema shared by
`src/app.ts` and `contract/schemas.ts`. One schema, read in both
places, so the contract suite validates against the same rules the
route enforces.

## Verification

| Behaviour | Level | How |
|---|---|---|
| B1, B2 | unit | call the pricing module directly with each band and known amounts |
| B3 | unit | two calls to the route return different `quoteId` values |
| B4, B5 | unit | the route, with an invalid body |
| The happy path over real HTTP | contract | the existing SPEC-002 test, updated to expect a priced body — asserts only that the three fields are present, never their values (ADR-001 forbids putting our invented rates in the file we'd hand the vendor team) |

## Main session owns

- `commission-quote-api-mock/README.md` — the band table and a worked
  example, replacing the stub body it shows now

## Edge cases

| Condition | Expected |
|---|---|
| `riskBand` absent | `400` |
| `riskBand` lowercase `a` | `400`. Exact match only |
| `riskBand` unknown, e.g. `D` | `400` |
| `loanAmount` absent, zero or negative | `400` |
| `loanAmount` not an integer | `400` |
| `loanTermInMonths` absent | `200`. No rate depends on it |
| Body absent, or not valid JSON | `400`. Nothing to price |
| Rounding lands on exactly half a cent | `Math.round` takes it up |

### Not handled

- Random failures — SPEC-004.
- Validating `loanTermInMonths`, or any bound on `loanAmount` beyond
  being a positive integer. Bounds belong to `api`, per ADR-004.
- Quote persistence. `quoteId` identifies a response, and nothing
  stores it.
- Anything in `web/`.

## Open questions

- (none)
