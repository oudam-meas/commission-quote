# ADR-003: The first slice and how it runs

**Status:** Accepted
**Date:** 2026-09-06

## Context

The stand-in answers over HTTP. `web/` is still empty. The next piece of work
is one thin slice through the whole app: a form in the browser, a quote
endpoint in `web`'s server, a call to the vendor, numbers back on screen.

Happy path only. Loading states and error messages belong to ADR-004 and a
later spec.

Two things make the slice awkward to build against the stand-in. It fails on
purpose — SPEC-004 gives it a 20% failure rate. And it needs its own process
and its own `API_KEY` before it answers anything. Building a form against that
means fighting failures the slice does not cover yet.

## Decision

### The slice

`web/src/client/` gets the form and a display area. `web/src/server/` gets
`POST /api/quote`. The server holds the `api-key` and reaches the vendor
through `vendor/client.ts`. ADR-002 already fixed those folders.

Tests are the levels ADR-002 already defines. Unit tests on the modules — the
form, the fetching hook, the vendor client, config. Integration tests on the
endpoint through Hono's `app.request()`, with the vendor client swapped for a
hand-written double. The contract suite already covers the real HTTP call.

### Two ways to run

`npm run dev` starts `web` on its own, wired to a vendor double. Two
processes, no `API_KEY`, no stand-in, every quote succeeds. That is the loop
for building the UI.

`npm start` starts everything: the stand-in on `4000`, `web`'s server on
`4001`, Vite on `5173`. The browser then runs the real vendor path, random
failures included. That is the command the README gives a reviewer.

### The double lives outside `src/`

`web/dev/vendor-double.ts`, in a top-level folder beside `src/`. `dev/` imports
from `src/`. Nothing under `src/` imports from `dev/`. The production build
compiles `src/` alone, so the double has no route into a shipped bundle.
Deleting `dev/` must leave `web` compiling.

### The server never asks which mode it is in

No `NODE_ENV` branch inside the server. Two entry files instead.
`src/server/main.ts` builds the app with the real vendor client. `dev/main.ts`
builds it with the double. The npm script picks the file, and the app itself
stays the same in both.

ADR-002 already put the vendor client in through the constructor, for the
integration tests. Dev mode reuses that seam, so the second run mode costs one
small file.

The dev double is its own file. Test doubles stay under `web/tests/`, because
a test pins one outcome per case and the dev double always succeeds.

### The vendor client holds its own deadline

Every in-flight request holds a connection and memory. Without a bound, a
slow vendor exhausts our own capacity, and our service goes down because
theirs did.

This is not how the brief's timeout case gets covered — the stand-in
answers `504` on its own, and `api` already maps that, per ADR-004. The
deadline covers the one thing the stand-in cannot produce: a vendor that
never answers at all.

It lives in `vendor/client.ts`, on the `fetch` call itself, via
`AbortSignal.timeout()`. Not in the route. Putting it in the route was
this ADR's first instinct, because the hand-written vendor-client double
in `web/tests/` carries no signal of its own — a deadline inside the real
client would never fire against it. That reasoning shaped production code
around a test double's limitation. The double is what changes instead: it
now honours whatever signal it is handed, the same way `fetch` does.

3 seconds is arbitrary. With a real vendor it would come from their p99
plus headroom.

A deadline is not a circuit breaker. It stops one request hanging, not a
thousand piling up. Out of scope.

### One repo-level package starts things, and owns nothing else

A root `package.json` arrives with this slice. It is a utility. No `src/`, no
tests, no ports, no env vars. Its one dependency is `concurrently`, already
chosen in ADR-002 and the boring pick here: one line starts several processes,
labels their output, and kills them together on Ctrl-C.

Its scripts call each package's own scripts and stop there. `start` runs the
stand-in's start script and `web`'s. `test` fans out to both suites. Each
package keeps its own config, its own `node_modules` and its own install, so
the boundary in ADR-002 holds. Deleting the stand-in leaves one line to remove
here.

## Consequences

- A path can work under `dev` and break under `start`. What `dev` skips is
  `vendor/client.ts` and its config. One module. The contract suite tests that
  module against the running stand-in, and `npm start` walks the whole path by
  hand every time anyone opens the app.
- The double must answer the shape in ADR-001's table. If it drifts, dev lies
  about what works. It is a few lines, and the contract suite catches drift on
  the real side.
- This replaces ADR-002's closing line about one `npm run dev` at the root
  starting three processes. `dev` starts two. `start` starts three.
- Vite proxies `/api` to `4001` in both modes. The client keeps one relative
  URL and never learns a port.
- `npm run dev` needs no `.env`. `npm start` still needs the stand-in's
  `API_KEY` and `web`'s matching key, and it says so when either is missing.
