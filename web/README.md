# web

The UI and the API layer in one deployable.

`src/client/` is React, served by Vite. `src/server/` is Hono, and it
holds the vendor `api-key`. A browser cannot keep a secret, which is the
whole reason the server half exists. See
[ADR-002](../sdd/ADRs/ADR-002-project-setup-and-boundary.md).

This package imports nothing from `commission-quote-api-mock/`.

## Run it

Two processes, two terminals.

```shell
npm install
npm run start:server    # http://localhost:4001
```

```shell
npm run start:client    # http://localhost:5173
```

Copy `.env.example` to `.env` first. `VENDOR_URL` and `VENDOR_API_KEY`
have no default — the server refuses to start without them and says
which one is missing. `PORT` is optional and defaults to `4001`.

Check the server:

```shell
curl http://localhost:4001/health
# {"status":"ok"}
```

## When the vendor fails

`src/server/vendor/client.ts` throws for anything other than a `200`
from the vendor, and for its own deadline elapsing first.
`src/server/services/quote-service.ts` sorts what it catches into a
response:

| What happened | Status to the browser | `code` |
|---|---|---|
| the vendor's own deadline elapsed, or `web`'s did first | `503` | `VENDOR_TIMEOUT` |
| vendor answered anything other than `200` | `502` | `VENDOR_UNAVAILABLE` |
| vendor answered `200`, but the body breaks the outbound contract | `500` | `INVALID_RESPONSE` |
| the request itself was invalid | `400` | `INVALID_REQUEST` |
| anything else — e.g. `ECONNREFUSED`, the vendor process is down | `500` | `INTERNAL_ERROR` |

Every response follows one shape, `ErrorResponse` in
`src/server/errors/error-response.ts`: `{ code: string; message: string }`,
wrapped as `{ error: ErrorResponse }`. The vendor's own error body is
never parsed or forwarded — this repo's invariant is that no raw
vendor error reaches the user.

What the vendor mock itself can answer is documented in
[its README](../commission-quote-api-mock/README.md#it-fails-on-purpose).

## Test it

```shell
npm test          # unit and integration tests
npm run typecheck # both halves
```

`typecheck` runs the compiler twice, once per tsconfig. That is the point
of splitting them: `src/server/` is checked with Node globals and
NodeNext resolution, `src/client/` with DOM and bundler resolution. A
React import inside `src/server/` fails.

Integration tests treat the server's endpoints as a black box, with the
vendor client swapped for a hand-written double, one per error category.

## What works today

The quote form, `POST /api/quote`, and a vendor call sorted into a
handful of plain-message categories on failure. See
[When the vendor fails](#when-the-vendor-fails).

| Spec | Covers | Built |
|---|---|---|
| [SPEC-005](../sdd/specs/005-web-scaffold.md) | package, health check, placeholder page | yes |
| [SPEC-006](../sdd/specs/006-web-quote-slice.md) | the quote form and `POST /api/quote` | yes |
| [SPEC-007](../sdd/specs/007-run-modes.md) | root scripts, running the app | yes |
| [SPEC-008](../sdd/specs/008-api-error-categories.md) | validation both directions, error categories, logging | yes |
| [SPEC-009](../sdd/specs/009-client-loading-and-error-states.md) | loading state, quote and message on screen | yes |

## Config

| Var | Default | Read by |
|---|---|---|
| `VENDOR_URL` | none — required | the server |
| `VENDOR_API_KEY` | none — required | the server |
| `PORT` | `4001` | the server |
