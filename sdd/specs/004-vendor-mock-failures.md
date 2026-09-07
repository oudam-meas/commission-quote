---
id: SPEC-004
title: Vendor mock — random failure simulation
status: done
primary_test_level: unit
touches: [commission-quote-api-mock/]
---

## Intent

The brief says the Commission Quote API must occasionally throw an
error at random. Add that. No way to select an outcome. Pricing already
applies by this spec — the quote body is SPEC-003's priced quote, not
SPEC-002's stub.

Five things can go wrong, and they are not the same kind of wrong:

- A `500` and a `502` — the vendor itself answering with a fault.
- A `504` — fast, simulating a proxy in front of the vendor (an ALB,
  say) giving up and answering on the vendor's behalf.
- A genuinely slow answer — no error at all, just latency real enough
  that a caller enforcing its own deadline gives up first. Every
  service sees this sometimes; it is not the vendor being wrong.
- A `200` that lies about its own shape — the vendor answering as if
  nothing were wrong, on a body that breaks the outbound contract.

The `504` and the slow answer are easy to conflate, because `api`'s
vendor client treats both as "the vendor timed out." They exercise two
different parts of that client, though: a `504` is a fast status code
the client's own status-sorting has to recognise; the slow answer
never sends the client a status at all, because the client's own
`AbortSignal.timeout()` fires and gives up first. Testing one proves
nothing about the other.

The malformed `200` exercises a third, separate part of `api`: not
status-sorting, not the deadline, but the outbound contract check that
runs after a `200` is already in hand. Nothing about the response says
anything is wrong until that check runs.

## Behaviours

- B1: `pickOutcome` returns `success`, `error`, `badGateway`, `timeout`,
  `slow` or `malformed` depending on the random number it is given.
- B2: A picked `error` returns `500` with the error body. A picked
  `badGateway` returns `502` with the error body.
- B3: A picked `timeout` returns `504` with the error body,
  immediately — no wait.
- B4: A picked `slow` waits before answering — long enough to outlast
  the deadline `api`'s vendor client holds — then answers `200` with
  the priced quote, the same as `success`. A picked `success` returns
  `200` with the priced quote immediately.
- B5: The `api-key` check runs before the pick. A request with no valid
  key gets `401` and never reaches it.
- B6: `GET /health` answers `200` whatever the pick would have been.
- B7: `FAILURE_RATE` sets the chance of an outcome other than `success`.
  It defaults to `0.2`, so roughly one request in five fails unless it
  is set. `0` turns the simulation off.
- B8: A picked `malformed` returns `200` immediately, with a body that
  matches the priced quote's shape but carries a `commissionRate` outside
  the `(0, 1)` the outbound contract requires.

## Contract

**The picker takes its random number as an argument.**

```
pickOutcome(randomNumber: number): 'success' | 'error' | 'badGateway' | 'timeout' | 'slow' | 'malformed'
```

Passing the number in is what makes every outcome testable without an
env var. The route calls `pickOutcome(Math.random())`. That is the one
place randomness enters.

**The rate is a dial.** `FAILURE_RATE` is the total chance of an
outcome other than immediate success, default `0.2`, split evenly
across the five other kinds. `pickOutcome` takes it alongside the
random number:

```
pickOutcome(randomNumber, failureRate)
```

| Range | Outcome |
|---|---|
| `[0, 1 - failureRate)` | `success` |
| first fifth of the remainder | `error` |
| second fifth | `badGateway` |
| third fifth | `timeout` |
| fourth fifth | `slow` |
| last fifth | `malformed` |

At `0`, every request succeeds immediately. At `0.2`, the default,
that first row shrinks to `[0, 0.8)` and each of the other five gets
`0.04` — a fresh `npm start` fails about one request in five.

The dial exists so the whole stack can be walked end to end once it is
turned up. Stepping through a form while one request in five fails at
random tells you nothing about the form. Turning `FAILURE_RATE` up to
`0.7`–`0.8` for a while and clicking through the form is how each path
— including the slow one — gets watched by hand. See "Not handled"
below.

There is still no way to demand one particular outcome. `FAILURE_RATE`
turns the whole rate up or down; it does not let a caller choose which
fifth of that band it lands in. See ADR-001.

A value outside `0` to `1`, or one that is not a number, raises at
startup the same way a bad `API_KEY` does. An empty string means absent,
so it gives the default `0.2` — not the `0` that `Number('')` happens
to produce. The explicit absent check is what keeps those two apart;
reading `FAILURE_RATE` as a number before checking whether it was set
at all would silently turn the simulation off.

**The route reads the rate from the same config call it already makes.**
It reads `apiKey` per request through `readConfig(process.env)`, so it
takes `failureRate` from that same result and passes it to the picker.
No new plumbing, and one place still reads config.

This needs its own proof. Every other B7 test exercises `pickOutcome` or
`readConfig` directly, so all of them pass even if the route still
handed the picker some hard-coded rate of its own. A `FAILURE_RATE` set
in the environment would then be ignored.

**Only `slow` waits.** `api`'s vendor client gives up on its own after a
fixed deadline (`AbortSignal.timeout()` in
`web/src/server/vendor/client.ts`). `timeout` stays a fast `504`,
because that is what a real proxy answering on the vendor's behalf
looks like — proving the client's status-sorting handles it. `slow`
is the one that actually waits, through an injected `sleep` function,
for longer than that deadline, so the client's own `AbortSignal`
firing gets proven too. The wait is a dependency for the same reason
the picker is: a unit test pins a fast no-op sleep and asserts the
real delay was asked for, instead of a test suite waiting out several
seconds per run.

**Validation runs before the pick.** The order in the route is: api-key,
body readable, `loanAmount`, `riskBand`, then the pick. An invalid
request is the caller's fault and answers the same way every time. A
random `500` for a request that is definitively invalid would tell the
caller to retry something that can never succeed. It also keeps every
`400` test deterministic. (Not to be confused with the `malformed`
outcome above — that one is the vendor's own response failing to hold
its shape, on a request that was valid all along.)

`500` body:
```json
{ "error": { "code": "VENDOR_ERROR", "message": "The quote service failed" } }
```

`502` body:
```json
{ "error": { "code": "VENDOR_BAD_GATEWAY", "message": "The quote service is temporarily unavailable" } }
```

`504` body:
```json
{ "error": { "code": "VENDOR_TIMEOUT", "message": "The quote service did not answer in time" } }
```

`slow` carries no error body at all — it is the same `200` priced quote
`success` returns, just late.

`malformed` also carries no error body — it is the priced quote's shape,
with `commissionRate` overwritten to `12`, a value the outbound contract
(`web/src/server/contracts.ts`'s `quoteSchema`) rejects. Nothing about
the response says anything is wrong; that is what makes it a contract
failure rather than a status-code one.

Same envelope as SPEC-002's `401`, per ADR-001's single error shape.

**Seams.** The route takes its picker and its sleep as arguments, so a
test can supply both doubles.

## Verification

| Behaviour | Level | How |
|---|---|---|
| B1 | unit | call `pickOutcome` with boundary values |
| B2, B3, B4, B8 | unit | the route, with the picker replaced by a hand-written double returning a fixed outcome, and the sleep replaced by a recording double |
| B4, the wait | unit | a recording sleep double proves `slow` asks to wait longer than the client's deadline, and that no other outcome waits at all |
| B5 | unit | no valid key, with the double set to `error`; expect `401` |
| B6 | unit | call `/health` with the double set to `error` |
| B7, the bands | unit | call `pickOutcome` with rates `0`, an example nonzero rate, and `1` |
| B7, the config | unit | read config with `FAILURE_RATE` absent, empty, `0`, and a bad value |
| B7, the wiring | unit | `FAILURE_RATE=0` in the environment, the real picker, many calls to the route, every one a `200` |

None of the failure paths run over real HTTP — see Rationale.

## Edge cases

The random-number rows below assume `FAILURE_RATE=0.2`, the default.

| Condition | Expected |
|---|---|
| Random number exactly `0.8` | `error` |
| Random number exactly `0.84` | `badGateway` |
| Random number exactly `0.88` | `timeout` |
| Random number exactly `0.92` | `slow` |
| Random number exactly `0.96` | `malformed` |
| Random number `0` | `success` |
| No valid `api-key` | `401`, whatever the pick would have been |
| `GET /health` | `200` always. The pick never applies to it |

### Not handled

- Pricing. The `200` body is still SPEC-003's priced quote.
- Request body validation.
- Any way to force or select a specific outcome. Cut deliberately —
  the brief asks for a random failure and nothing more. `FAILURE_RATE`
  turned up (`0.7`–`0.8`) and watched by hand while exercising the app
  is how each path gets seen; that stays hand-checked, not a test.
- Anything in `web/`.

## Open questions

- (none)

---

## Rationale

**The contract suite needs `FAILURE_RATE=0` set explicitly.** A
contract test cannot force one outcome, and this stand-in fails on
purpose when asked to — those two facts together mean the suite needs
failure off entirely, not merely tolerated. The default was `0` for
exactly that reason. It rose to `0.2` so a fresh start shows the
brief's random failure, and the burden moved to the contract run: start
the server it targets with `FAILURE_RATE=0`.
