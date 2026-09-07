# commission-quote-api-mock

Stands in for the vendor Commission Quote API, which is not built yet.

A real HTTP service on its own port. It accepts real requests and returns
real responses. It is deleted the day the real vendor ships. See
[ADR-001](../sdd/ADRs/ADR-001-vendor-stand-in.md).

This package is standalone. It has its own `package.json` and its own
`node_modules`, and it imports nothing from `web/`.

It can simulate the vendor failing, on purpose. Off by default
(`FAILURE_RATE=0`), so a plain `npm start` never fails on its own. See
[It fails on purpose](#it-fails-on-purpose).

## Run it

```shell
npm install
cp .env.example .env
npm start
```

`.env` holds `API_KEY`. The server refuses to start without it and tells
you so. `.env` is gitignored; `.env.example` is committed.

It listens on `http://localhost:4000`. Set `PORT` to change that.

Check it is up:

```shell
curl http://localhost:4000/health
# {"status":"ok"}
```

Ask for a quote. The `api-key` header must match `API_KEY`:

```shell
curl -X POST http://localhost:4000/commission-quote \
  -H 'api-key: local-dev-key' \
  -H 'content-type: application/json' \
  -d '{"loanAmount":250000,"loanTermInMonths":360,"riskBand":"LOW"}'
# {"quoteId":"0618fbba-…","commissionRate":0.015,"totalCommission":3750}
```

Money is in cents, going in and coming back. `250000` cents is
$2,500.00. At band `LOW` that is 1.5%, so `3750` cents, or $37.50.

| `riskBand` | Rate |
|---|---|
| `LOW` | `0.015` |
| `MEDIUM` | `0.0125` |
| `HIGH` | `0.01` |

The bands and the rates are invented. The brief fixes neither, and the
real vendor will define its own. See
[SPEC-003](../sdd/specs/003-vendor-mock-pricing.md).

`riskBand` is matched exactly, so `low` is rejected. An unknown band, a
`loanAmount` that is not a positive integer, or a body that is not valid
JSON all return `400`:

```shell
curl -X POST http://localhost:4000/commission-quote \
  -H 'api-key: local-dev-key' \
  -H 'content-type: application/json' \
  -d '{"loanAmount":250000,"riskBand":"D"}'
# {"error":{"code":"INVALID_REQUEST","message":"Invalid option: expected one of \"LOW\"|\"MEDIUM\"|\"HIGH\""}}
```

`loanTermInMonths` is accepted and ignored. No rate depends on it yet.

## It fails on purpose

The brief asks the vendor API to throw an error at random. `FAILURE_RATE`
(0 to 1) turns that on. At `0.2`, roughly one request in five is
something other than an immediate priced quote, split evenly across
five kinds:

| Outcome | Status |
|---|---|
| priced quote | `200`, immediately |
| vendor error | `500`, immediately |
| vendor bad gateway | `502`, immediately |
| vendor timeout | `504`, immediately — stands in for a proxy (an ALB) giving up on the vendor's behalf |
| vendor slow | `200`, after several seconds — no error, just a real delay past `web`'s own deadline |
| vendor malformed | `200`, immediately, `commissionRate` outside `(0, 1)` — proves `web` checks the body, not just the status |

Send the same request again and a failure will usually succeed. The
`api-key` check and all validation run before the random pick, so a
wrong key is always `401` and a bad `riskBand` is always `400`.
`GET /health` never fails.

```shell
FAILURE_RATE=0.8 npm start   # watch a failure path by hand
```

`FAILURE_RATE` turns the rate up or down, not which outcome lands.
Each path already has its own unit test with a hand-written double.

Without a valid key it returns `401`:

```shell
curl -i -X POST http://localhost:4000/commission-quote
# HTTP/1.1 401 Unauthorized
# {"error":{"code":"UNAUTHORIZED","message":"Missing or invalid api-key"}}
```

## Test it

```shell
npm test              # unit tests, no server needed
npm run typecheck
```

Contract tests need a running server, so they're a separate command.
Start the server in one terminal with `FAILURE_RATE` unset (the
suite can't force one outcome, so it relies on the random failure
staying off), then in another:

```shell
npm run test:contract
```

They make a real HTTP call to `VENDOR_URL` (default
`http://localhost:4000`), checking status codes and response shape,
never values. Point `VENDOR_URL` at the real vendor once it exists and
the same file runs unedited.

## What works today

Everything this package is meant to do. `GET /health`, and
`POST /commission-quote` behind the `api-key` check, priced from the risk
band, failing at random.

| Spec | Covers | Built |
|---|---|---|
| [SPEC-001](../sdd/specs/001-vendor-mock-bootstrap.md) | server, `GET /health`, contract harness | yes |
| [SPEC-002](../sdd/specs/002-vendor-mock-auth-and-stub.md) | `api-key` rejection, quote endpoint | yes |
| [SPEC-003](../sdd/specs/003-vendor-mock-pricing.md) | risk band pricing, request validation | yes |
| [SPEC-004](../sdd/specs/004-vendor-mock-failures.md) | random 500, 502, a fast 504, a genuinely slow success, and a malformed success | yes |

## Config

| Var | Default | Used by |
|---|---|---|
| `API_KEY` | none — required | the server |
| `FAILURE_RATE` | `0` | the server |
| `PORT` | `4000` | the server |
| `VENDOR_URL` | `http://localhost:4000` | the contract tests |
| `VENDOR_API_KEY` | `local-dev-key` | the contract tests |
