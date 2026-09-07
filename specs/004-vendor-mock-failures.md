---
id: SPEC-004
title: Vendor mock — random failure simulation
status: ready
primary_test_level: unit
touches: [commission-quote-api-mock/]
---

## Intent

The brief says the Commission Quote API must occasionally throw an
error at random. Add that. Nothing else — no override, no way to
select an outcome. Pricing stays out; the quote body is still SPEC-002's
stub.

## Behaviours

- B1: `pickOutcome` returns `success`, `error` or `timeout` depending on
  the random number it is given.
- B2: A picked `error` returns `500` with the error body.
- B3: A picked `timeout` returns `504` with the error body, answered
  immediately.
- B4: A picked `success` returns `200` with the stub quote.
- B5: The `api-key` check runs before the pick. A request with no valid
  key gets `401` and never reaches it.
- B6: `GET /health` answers `200` whatever the pick would have been.
- B7: `FAILURE_RATE` sets the chance of failure. It defaults to `0.2`,
  and `0` makes every quote succeed.

## Contract

**The picker takes its random number as an argument.**

```
pickOutcome(randomNumber: number): 'success' | 'error' | 'timeout'
```

| Range | Outcome |
|---|---|
| `[0, 0.8)` | `success` |
| `[0.8, 0.9)` | `error` |
| `[0.9, 1)` | `timeout` |

Passing the number in is what makes every outcome testable without an
env var. The route calls `pickOutcome(Math.random())`. That is the one
place randomness enters.

**Weights.** Success `0.8`, error `0.1`, timeout `0.1`. A stand-in
failing half the time is unusable for building a UI against. Failures
still appear often enough to notice.

**The rate is a dial.** `FAILURE_RATE` is the total chance of failure,
default `0.2`, split evenly between error and timeout. `pickOutcome`
takes it alongside the random number:

```
pickOutcome(randomNumber, failureRate)
```

| Range | Outcome |
|---|---|
| `[0, 1 - failureRate)` | `success` |
| next half of the remainder | `error` |
| last half | `timeout` |

At the default this is the 80/10/10 table above, unchanged. At `0` every
request succeeds.

The dial exists so the whole stack can be walked end to end. Stepping
through a form while one request in five fails at random tells you
nothing about the form. It gives nobody a way to demand a specific
failure, so the reasoning that cut `FORCE_OUTCOME` still holds — see
ADR-001.

A value outside `0` to `1`, or one that is not a number, raises at
startup the same way a bad `API_KEY` does. An empty string means absent,
so it gives `0.2`. `Number('')` is `0` in JavaScript, so the obvious
implementation would silently switch failures off — the one reading that
would break the brief without anyone noticing.

**The route reads the rate from the same config call it already makes.**
It reads `apiKey` per request through `readConfig(process.env)`, so it
takes `failureRate` from that same result and passes it to the picker.
No new plumbing, and one place still reads config.

This needs its own proof. Every other B7 test exercises `pickOutcome` or
`readConfig` directly, so all of them pass while the route still hands
the picker a hard-coded `0.2`. `FAILURE_RATE=0` would then be ignored.

**504 answers immediately.** ADR-001 is explicit that the status
category is what matters. `api` sets its own deadline.

**Validation runs before the pick.** The order in the route is: api-key,
body readable, `loanAmount`, `riskBand`, then the pick. A malformed
request is the caller's fault and answers the same way every time. A
random `500` for a request that is definitively invalid would tell the
caller to retry something that can never succeed. It also keeps every
`400` test deterministic.

`500` body:
```json
{ "error": { "code": "VENDOR_ERROR", "message": "The quote service failed" } }
```

`504` body:
```json
{ "error": { "code": "VENDOR_TIMEOUT", "message": "The quote service did not answer in time" } }
```

Same envelope as SPEC-002's `401`, per ADR-001's single error shape.

### Where each behaviour is proven

| Behaviour | Level |
|---|---|
| B1 | unit — call `pickOutcome` with boundary values |
| B2, B3, B4 | unit — the route, with the picker replaced by a hand-written double returning a fixed outcome |
| B5 | unit — no valid key, with the double set to `error`; expect `401` |
| B6 | unit — call `/health` with the double set to `error` |
| B7, the bands | unit — call `pickOutcome` with rates `0`, `0.2` and `1` |
| B7, the config | unit — read config with `FAILURE_RATE` absent, empty, `0`, and a bad value |
| B7, the wiring | unit — `FAILURE_RATE=0` in the environment, the real picker, many calls to the route, every one a `200` |

The route takes its picker as an argument so a test can supply the
double. That keeps the seam visible in the code.

Nothing here adds a contract test. ADR-001 puts the happy path and the
401 in the contract suite, and both already exist from SPEC-001 and
SPEC-002. A contract test cannot force a failure without an override,
and the override is what this spec deliberately does not build.

**This breaks the existing contract suite, and that has to be fixed
here.** The happy-path row expects `200`. Once the pick lands, that row
fails one time in five. A deliverable that fails at random is worse than
no deliverable.

The fix: that row retries. It calls until it gets a `200`, up to five
attempts, then asserts the schema on that response. Five attempts miss
only 0.2^5 of the time, about once in three thousand runs.

Retrying is honest here. The vendor fails sometimes by design, so a
suite pointed at it has to tolerate that. It stays a real HTTP call
against a real process, and the schema assertion is unchanged.

The `401` rows need no retry. The api-key check runs before the pick, so
they are deterministic already — B5 is what guarantees that.

**Run instructions.** `commission-quote-api-mock/README.md` gains a line
saying the quote endpoint fails at random, with the rough odds, so a
reviewer seeing a `500` knows it is intended.

## Edge cases

| Condition | Expected |
|---|---|
| Random number exactly `0.8` | `error` |
| Random number exactly `0.9` | `timeout` |
| Random number `0` | `success` |
| No valid `api-key` | `401`, whatever the pick would have been |
| `GET /health` | `200` always. The pick never applies to it |

### Not handled

- Pricing. The `200` body is still SPEC-003's priced quote.
- Request body validation.
- Any real delay before the `504`.
- Any way to force or select an outcome. Cut deliberately — the brief
  asks for a random failure and nothing more.
- Anything in `web/`.

## Open questions

- (none)
