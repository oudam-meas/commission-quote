# ADR-001: The vendor stand-in

**Status:** Accepted
**Date:** 2026-09-07

## Context

The vendor that calculates commission doesn't exist yet. The brief fixes
only this:

| | Fields |
|---|---|
| Request | `loanAmount`, `loanTermInMonths`, `riskBand` |
| Response | `quoteId`, `commissionRate`, `totalCommission` |

Also required: an `api-key` header, and a vendor that throws errors at
random. Nothing else. No types, units, bounds, or timeout. Everything past
this point is a decision, not the brief.

Three things get called "mock" here:

| Term | Is |
|---|---|
| **commission-quote-api-mock** | A real HTTP service, own port, standing in for the vendor |
| **Test double** | Fake code inside a test. No process, no network |
| **Contract test** | A real HTTP call to `VENDOR_URL`. Checks shape and status only, never values |

## Decision

The stand-in is hand-rolled, not WireMock, Prism or Pact. Three fields
each way isn't worth setting up a tool for. Pact also solves a different
problem, telling a provider team when they've broken a consumer before
deploy, and that needs two teams and a broker. There's one repo here and
no provider yet.

It knows nothing about lending. A fixed rate per risk band, multiplied and
rounded to cents. No upfront/trail split, no accrual, no clawback. It
satisfies the contract, not the domain, because how the real vendor prices
commission isn't known. The rate is fixed; only the failure pick is
random.

Failures are random, and there's no way to force one. An override to
demand a specific outcome was built, then cut, because the brief never
asks for one and it was leaking into specs and tests as though it were a
requirement. `FAILURE_RATE` survived as a dial instead. It's off by
default and only turns the whole rate up or down, never picks which
outcome lands. Every error shares one body shape, and `api` reads the
status code alone, so swapping in the real vendor stays a config change
instead of a code change.

The contract test is the deliverable, what I'd hand a vendor team to show
what we agreed. One row per endpoint: request, expected status, expected
shape. Each row is checked by a `zod` schema that states shape only, never
an exact value, because a made-up rate would leak my guess into the
contract. It's a real fetch over a real port, never Hono's in-process
`app.request()`, so it never imports the stand-in.

Its schemas live in `contract/`, a sibling of `src/` and `tests/`, shared
by the test and by `app.ts`'s own request validation. One contract stated
once, instead of two that could drift apart by hand.

The stand-in itself gets deleted the day the real vendor ships. The
contract test and `api`'s vendor client interface don't.

## Consequences

- `web/` and the stand-in never import each other.
- Their response shapes are two different types, even though they look
  alike today.
- The failure picker has its own unit test. Every other test assumes it's
  right.
- Whether a random failure actually appears while clicking around stays
  hand-checked, not tested.
