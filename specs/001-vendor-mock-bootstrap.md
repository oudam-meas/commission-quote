---
id: SPEC-001
title: Vendor mock — bootstrap and contract test harness
status: ready
primary_test_level: contract
touches: [commission-quote-api-mock/]
---

## Intent

Stand up `commission-quote-api-mock` as its own runnable HTTP process,
independent of `web`'s structure or existence. It needs a route shape that
later endpoints can be added to, and a contract test suite that proves the
process actually answers over real HTTP — as a blackbox, not by importing
the mock's code. This spec has no quote logic yet. It only proves the
scaffold and the test harness both work.

## Behaviours

- B1: Running the mock's start script starts an HTTP server listening on
  the configured port (default `4000`, per README).
- B2: `GET /health` returns `200` with a JSON body, proving the route
  registration shape is in place and ready to take a real endpoint.
- B3: The contract test suite runs as its own command, separate from the
  server process, and makes a real HTTP request against `VENDOR_URL` (not
  Hono's in-process `app.request()`) to prove B1 and B2 hold.

## Contract

**Start command** — `commission-quote-api-mock/package.json` exposes a
script that starts the server: `npm start`, run from inside the package
folder.

**Config** — `PORT` env var, default `4000` if unset.

**`GET /health`**

Response, `200`:
```json
{ "status": "ok" }
```

**Contract test command** — `commission-quote-api-mock/package.json`
exposes a script (e.g. `npm run test:contract`) that:
1. Reads `VENDOR_URL` from env, default `http://localhost:4000`.
2. Does a real `fetch(`${VENDOR_URL}/health`)`.
3. Asserts status `200` and that the body has a `status` field.

This command must be runnable on its own, against an already-running mock
process. It does not start the server itself.

**Dependencies** — recorded because `CLAUDE.md` requires a reason for
each.

| Package | Reason |
|---|---|
| `hono` | The HTTP framework. Named in `CLAUDE.md`'s project structure. |
| `@hono/node-server` | Hono does not bind a Node port on its own. B1 needs a listener. |
| `tsx` | Runs TypeScript with no build step. Node 20 cannot strip types without one. |
| `vitest`, `typescript`, `@types/node` | Test runner and types. Named in `CLAUDE.md`. |

**Scripts** — four, no more: `start`, `test` (unit), `test:contract`,
`typecheck`.

**Logging** — the server prints the bound port on startup, and requests
go through Hono's `logger()` middleware. A start script that prints
nothing cannot be told apart from one that hung, and the request log is
what makes an injected failure visible when demonstrating one later.

**Run instructions** — `commission-quote-api-mock/README.md` states how
to install, start, and test the package. Per `CLAUDE.md`'s loop, the
spec is not done until someone who has not seen the code can run it
from that file.

## Edge cases

| Condition | Expected behaviour |
|---|---|
| `PORT` env var not set | Server listens on `4000`. |
| `VENDOR_URL` env var not set (contract test) | Test targets `http://localhost:4000`. |

### Not handled

- The real quote endpoint, auth, or any calculation logic — SPEC-002.
- Any failure/error simulation (401, 5xx, 504) — SPEC-002
  and later, per ADR-001's Failures section.
- Anything in `web/` — this spec touches only
  `commission-quote-api-mock/`.

## Open questions

- (none)
