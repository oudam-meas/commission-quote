# web

The UI and the API layer in one deployable.

`src/client/` is React, served by Vite. `src/server/` is Hono, and it is
where the vendor `api-key` will live. A browser cannot keep a secret,
which is the whole reason the server half exists. See
[ADR-002](../ADRs/ADR-002-project-setup-and-boundary.md).

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

`.env` is optional here — `PORT` defaults to `4001`. Copy
`.env.example` to `.env` if you want to change it.

Check the server:

```shell
curl http://localhost:4001/health
# {"status":"ok"}
```

## Test it

```shell
npm test          # unit tests
npm run typecheck # both halves
```

`typecheck` runs the compiler twice, once per tsconfig. That is the point
of splitting them: `src/server/` is checked with Node globals and
NodeNext resolution, `src/client/` with DOM and bundler resolution. A
React import inside `src/server/` fails.

There is no `test:int` yet. Integration means the server's endpoints with
the vendor client swapped for a double, and neither exists until
[SPEC-006](../specs/006-web-quote-slice.md).

## What works today

The scaffold. `GET /health` on the server, and a placeholder page on the
client. No form, no quote endpoint, no vendor call.

| Spec | Covers | Built |
|---|---|---|
| [SPEC-005](../specs/005-web-scaffold.md) | package, health check, placeholder page | yes |
| [SPEC-006](../specs/006-web-quote-slice.md) | the quote form and `POST /api/quote` | no |
| [SPEC-007](../specs/007-run-modes.md) | dev double, root scripts | no |

## Config

| Var | Default | Read by |
|---|---|---|
| `PORT` | `4001` | the server |

The vendor variables arrive with SPEC-006.
