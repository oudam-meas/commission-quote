# commission-quote-api-mock

Stands in for the vendor Commission Quote API, which is not built yet.

A real HTTP service on its own port. It accepts real requests and returns
real responses. It is deleted the day the real vendor ships. See
[ADR-001](../ADRs/ADR-001-vendor-stand-in.md).

This package is standalone. It has its own `package.json` and its own
`node_modules`, and it imports nothing from `web/`.

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

About one request in five comes back `500` or `504` instead. That is the
mock working — see [It fails on purpose](#it-fails-on-purpose). Send it
again.

**Money is in cents, going in and coming back.** `250000` cents is
$2,500.00. At band `LOW` that is 1.5%, so `3750` cents, or $37.50.

| `riskBand` | Rate |
|---|---|
| `LOW` | `0.015` |
| `MEDIUM` | `0.0125` |
| `HIGH` | `0.01` |

The bands and the rates are invented. The brief fixes neither, and the
real vendor will define its own. See
[SPEC-003](../specs/003-vendor-mock-pricing.md).

`riskBand` is matched exactly, so `low` is rejected. An unknown band, a
`loanAmount` that is not a positive integer, or a body that is not valid
JSON all return `400`:

```shell
curl -X POST http://localhost:4000/commission-quote \
  -H 'api-key: local-dev-key' \
  -H 'content-type: application/json' \
  -d '{"loanAmount":250000,"riskBand":"D"}'
# {"error":{"code":"INVALID_REQUEST","message":"riskBand must be LOW, MEDIUM or HIGH"}}
```

`loanTermInMonths` is accepted and ignored. No rate depends on it yet.

## It fails on purpose

The brief asks the vendor API to throw an error at random, so
`POST /commission-quote` does. Roughly one request in five fails:

| Outcome | Odds | Status |
|---|---|---|
| priced quote | 80% | `200` |
| vendor error | 10% | `500` |
| vendor timeout | 10% | `504` |

A `500` or a `504` from this endpoint is the mock working. Send the same
request again and it will usually succeed.

The `504` answers straight away. What matters is the status category, so
the caller sets its own deadline rather than waiting on this one.

Everything else stays deterministic. The `api-key` check and all
validation run before the random pick, so a wrong key is always `401` and
a bad `riskBand` is always `400`. `GET /health` never fails.

### Turning it off

Set `FAILURE_RATE` to `0` and every quote succeeds:

```shell
FAILURE_RATE=0 npm start
```

Use that when you are working on something else and need the vendor to
stay out of the way. It is the total chance of failure, so `0.5` fails
half the time. Leaving it unset gives the real `0.2`.

There is no way to demand a specific failure. `FAILURE_RATE` turns the
brief's requirement down; it does not let you ask for a `504`. The error
paths are covered by unit tests with a hand-written double, and the root
README's next steps says when an override would be worth adding.

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

The contract tests are a separate command, because they need a running
server. Start the server in one terminal, then in another:

```shell
npm run test:contract
```

They make a real HTTP call to `VENDOR_URL`, which defaults to
`http://localhost:4000`. Point that at the real vendor when it exists and
the same file runs unedited — that is the whole purpose of the suite. It
checks status codes and response shape, never values.

## What works today

Everything this package is meant to do. `GET /health`, and
`POST /commission-quote` behind the `api-key` check, priced from the risk
band, failing at random.

| Spec | Covers | Built |
|---|---|---|
| [SPEC-001](../specs/001-vendor-mock-bootstrap.md) | server, `GET /health`, contract harness | yes |
| [SPEC-002](../specs/002-vendor-mock-auth-and-stub.md) | `api-key` rejection, quote endpoint | yes |
| [SPEC-003](../specs/003-vendor-mock-pricing.md) | risk band pricing, request validation | yes |
| [SPEC-004](../specs/004-vendor-mock-failures.md) | random 500 and 504 | yes |

## Config

| Var | Default | Used by |
|---|---|---|
| `API_KEY` | none — required | the server |
| `FAILURE_RATE` | `0.2` | the server |
| `PORT` | `4000` | the server |
| `VENDOR_URL` | `http://localhost:4000` | the contract tests |
| `VENDOR_API_KEY` | `local-dev-key` | the contract tests |
