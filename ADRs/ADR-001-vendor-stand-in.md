# ADR-001: The vendor stand-in

**Status:** Accepted
**Date:** 2026-09-05

## Context

The brief says an external vendor system calculates the commission. That system
is not available yet. We have the contract but not the system. So I built a
stand-in that implements the contract.

The brief fixes this much, and no more:

| | Fields |
|---|---|
| Request | `loanAmount`, `loanTermInMonths`, `riskBand` |
| Response | `quoteId`, `commissionRate`, `totalCommission` |

The API is strictly secured. It must require an `api-key` header and reject any
request without a valid key.

The random error is a requirement on the stand-in. The brief asks the API I
build to occasionally throw an error, to mimic real network conditions. It is
something I inject.

The brief also lists those three request fields for the UI form, but there it
writes "e.g.". The examples are loose. The contract above is not.

That is everything the brief fixes. No types, no units, no enumerations, no
bounds, no timeout.

Anything past this point is a decision. One that crosses specs belongs in an
ADR. One that lives inside a single spec is recorded there, with its reason —
not every choice needs its own file. A spec that names a field not in that
table has invented it.

The word "mock" gets used for a few different things. I am writing them down
here because mixing them up leads to the wrong tests.

## Decision

### What it is

**commission-quote-api-mock** is a real HTTP service on its own port. It
accepts real requests and returns real responses. It stands in for a vendor
that does not exist yet.

Two other things also get called mocks:

**Test double** is fake code inside a test. No process and no network. It
returns whatever the test tells it to return.

**Contract test** is a real HTTP call to whatever `VENDOR_URL` points at. It
works like an integration test. What makes it a contract test is what it does
not check. It checks the shape and the status code. It never checks values.

### It is hand-rolled

I did not use WireMock, Prism or Pact.

The contract has three fields going in and three coming out. Writing that by
hand is quicker than setting up a tool.

Pact also solves a different problem. It tells a provider team when they have
broken a consumer, before they deploy. That needs two teams, two repositories
and a broker. Here there is one repository and no provider yet.

### It knows nothing about lending

It uses a fixed rate for each risk band, multiplies, and rounds to cents. There
is no upfront and trail split. No accrual over the term. No clawback.

I do not know how the real vendor prices commission. The stand-in is here to
satisfy the contract, not to copy the domain.

The rate is fixed, not random. Randomness is only used for simulating failure.
One source of randomness is enough.

### Failures

The stand-in picks randomly between its outcomes. That is the whole of what
the brief asks for.

I had originally added an env var to override the pick, so I could demonstrate
a chosen outcome. I cut it. The brief asks for a random failure and says
nothing about controlling it, and the override was leaking into specs and tests
as though it were a requirement. The picking function takes its random number
as an argument instead, so a unit test can pin every outcome with no env var.

What survived is a dial, `FAILURE_RATE`, off by default. Turning it up
simulates the brief's requirement; it still gives nobody a way to demand one
particular outcome, so a contract test still cannot assert a `500` — the same
reasoning that killed the override above.

Which outcomes exist, and why there is more than one kind of failure, is
SPEC-004's detail, not this ADR's decision. What belongs here: every error
uses the same body shape, and `api` reads the status code and nothing else.
That is what makes swapping the stand-in for the real vendor a config change.

### The contract test is the deliverable

It reads `VENDOR_URL` from config, in the same way `api` does. Today it points
at the stand-in. Later it can point at the real vendor. Same file, no edits.

This is what I would hand to the vendor team to show what we agreed.

So it is written as a table, one row per endpoint: the request to send, the
status to expect, the fields the body must carry. A loop walks the rows. The
table reads as a document — this endpoint takes this, returns this shape, and
it is green.

That is data driving a loop, which the readability rules normally refuse. The
reason: the rows are the deliverable, and prose wrapped around each one buries
it. It applies to the contract suite alone. Unit tests stay one case per test,
so each fails for one reason.

Each row carries a Zod schema for the body it expects. A list of field names
says a field exists. A schema says what it is — a non-empty string, a rate
between 0 and 1, a whole number of cents — and reads as the contract rather
than a checklist. That is the new dependency: `zod`.

Reversed since: `zod` is no longer devDependency-only. The stand-in's own
`src/app.ts` uses the same library, on the same two request fields it
already checked by hand, so `zod` moved to a real dependency. One way to
read and validate a shape, not two.

The schemas stay shape. No exact value appears in any of them, because a
correct vendor implementation I have never seen has to pass this file
unedited.

It must not check the rate. The rates here are made up. Checking one would put
my guess into the contract, and it would fail against the first real
implementation. Exact values belong in the stand-in's own unit tests.

### It gets thrown away

The stand-in dies the day the real vendor ships. The contract test stays. So
does `api`'s vendor client interface.

## Consequences

- The stand-in imports nothing from `web/`, and `web/` imports nothing from the
  stand-in. Shared code would leak the throwaway part into the permanent part.
- The stand-in's response shape and `api`'s response shape are two different
  contracts. They look similar today. They must not be the same type.
- The contract test uses a real fetch over a real port. Not Hono's in-process
  `app.request()`. In-process would mean importing the stand-in, and that is
  the coupling this test exists to avoid. It runs separately because it needs
  a process running.
- The failure-picking logic gets a unit test. If it is wrong, every other test
  is built on a wrong assumption.
- One thing stays hand-checked: whether a random failure actually shows up
  while clicking around. Refresh until one appears.
