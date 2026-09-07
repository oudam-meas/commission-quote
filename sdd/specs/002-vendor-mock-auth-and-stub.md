---
id: SPEC-002
title: Vendor mock — auth rejection and stub quote response
status: ready
primary_test_level: contract
touches: [commission-quote-api-mock/]
---

## Intent

Add the quote endpoint's shape to the mock. Reject a bad `api-key`,
return a fixed body for a good one. No calculation yet — this spec
proves the endpoint and the security, nothing about pricing.

## Behaviours

- B1: A request with no `api-key` header is rejected with `401`.
- B2: A request with a wrong `api-key` is rejected with `401`.
- B3: A request with the configured `api-key` gets `200` and the stub
  body.
- B4: `GET /health` still answers without an `api-key`.
- B5: Reading config with `API_KEY` unset or empty raises, and the
  server exits non-zero instead of starting.

## Contract

| | |
|---|---|
| Endpoint | `POST /commission-quote` |
| Auth | `api-key` header, compared for exact equality with `API_KEY` |
| Auth scope | this route only |

**The path is our decision.** The brief names no URL. This one matches
the package name. When the real vendor publishes a path, it changes
here and nowhere else.

**Auth runs on this route alone.** `GET /health` is a liveness check
and takes no key. Mounting the check globally would break the passing
contract row at `commission-quote-api-mock/contract/contract.test.ts`.

**`API_KEY` has no default.** A stand-in that accepts any key when
misconfigured is worse than one that refuses to boot.

`401` body:
```json
{ "error": { "code": "UNAUTHORIZED", "message": "Missing or invalid api-key" } }
```

Every error the mock returns uses this shape — ADR-001 requires a
single body shape. The 5xx and 504 categories in a later spec reuse it
and change only `code` and `message`.

`200` body — fixed, ignores the request body entirely:
```json
{ "quoteId": "stub-quote-id", "commissionRate": 0, "totalCommission": 0 }
```

Field names come from ADR-001's contract table. They are the brief's,
not ours.

### Config

| Var | Default | Read by |
|---|---|---|
| `API_KEY` | none — required | the server |
| `VENDOR_API_KEY` | `local-dev-key` | the contract tests |

The mock's `API_KEY` and the caller's `VENDOR_API_KEY` must hold the same
value.

**How the value arrives.** The `start` script gains
`--env-file-if-exists=.env`, so a committed `.env.example` copied to
`.env` is enough. No dotenv dependency — Node reads the file itself.
The flag needs Node 20.12 or newer; verified on 22.18. `-if-exists`
rather than `--env-file` so a missing `.env` fails through B5's clear
message instead of a Node crash.

`commission-quote-api-mock/.env.example` is committed and carries
`API_KEY=local-dev-key`.

**Config module.** Config reading moves to its own module that returns
the values or raises. `src/server.ts` calls it, catches, and exits
non-zero — it currently calls `serve()` as an import side effect, which
nothing in it can be reached from a unit test.

## Verification

| Behaviour | Level | How |
|---|---|---|
| B1, B2, B3, B4 | contract | rows in `contract/contract.test.ts`, run by the existing `test:contract` script — status codes and field presence only |
| B3's literal values (`0`, `0`, the id string) | unit | the mock's own promise; ADR-001 forbids the contract suite from checking values |
| B5, the raise | unit | call the config module with the variable unset |
| B5, the non-zero exit | human | `API_KEY= npx tsx src/server.ts` prints the message and exits `1`. Reaching it needs a spawned process, and no test level covers that |

## Main session owns

- `commission-quote-api-mock/.env.example` — `API_KEY=local-dev-key`
- `commission-quote-api-mock/README.md` — the `.env` copy step and the
  quote endpoint

## Edge cases

| Condition | Expected |
|---|---|
| `api-key` header absent | `401` |
| `api-key` header present but empty | `401` |
| `api-key` value wrong | `401` |
| Request body missing or malformed, `api-key` valid | `200`, stub body |
| `GET /health` with no `api-key` | `200`, unchanged |
| `API_KEY` unset or empty at startup | process exits non-zero, names the variable |
| `.env` file absent, `API_KEY` set in the environment | starts normally |

### Not handled

- Real calculation — rate per risk band, rounding, integer cents.
- Request body validation. A malformed body still returns the stub.
- The other failure categories: 5xx and 504.
- Anything in `web/`.

## Open questions

- (none)
