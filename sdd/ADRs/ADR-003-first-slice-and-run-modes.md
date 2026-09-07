# ADR-003: The first slice and how it runs

**Status:** Accepted
**Date:** 2026-09-07

## Context

The stand-in answers over HTTP. `web/` is still empty. The next piece of
work is one thin slice through the whole app: a form in the browser, a
quote endpoint in `web`'s server, a call to the vendor, numbers back on
screen. Happy path only. Loading states and error messages belong to
ADR-004 and a later spec.

## Decision

`web/src/client/` gets the form and a display area. `web/src/server/`
gets `POST /api/quote`. The server holds the `api-key` and reaches the
vendor through its own vendor client module. ADR-002 already fixed those
folders.

Tests are the levels ADR-002 already defines: unit tests on the modules,
integration tests on the endpoint with the vendor client swapped for a
hand-written double, and the contract suite already covering the real
HTTP call.

The vendor client holds its own deadline. Every in-flight request holds
a connection and memory, and without a bound, a slow vendor would exhaust
our own capacity and take our service down with it. This isn't how the
brief's timeout case gets covered — the stand-in answers `504` on its
own, and `api` already maps that, per ADR-004. The deadline covers the
one thing the stand-in can't produce on its own: a vendor that never
answers at all. It lives on the `fetch` call itself, through
`AbortSignal.timeout()`, not in the route. Three seconds is arbitrary;
with a real vendor it would come from their p99 plus headroom. It's a
deadline, not a circuit breaker — it stops one request hanging, not a
thousand piling up. That's out of scope.

A root `package.json` starts everything. It owns nothing else: no
`src/`, no tests, no ports, no env vars. Its one dependency is
`concurrently`, already chosen in ADR-002, because one line can start
several processes, label their output, and kill them together on
Ctrl-C. Its scripts call each package's own scripts and stop there, so
the boundary in ADR-002 holds and deleting the stand-in leaves one line
to remove here.

A second way to run `web` alone, against a vendor double, was built and
then cut. It let the UI get built without the stand-in's failure rate in
the way, but it meant two entry points into the server and two sets of
run instructions for a problem `FAILURE_RATE=0` already solves. See
SPEC-007.

## Consequences

- There's one way to run the app now, so there's nothing left to diverge
  from it. The contract suite is what proves `web`'s vendor client
  against a real HTTP call.
- Vite proxies `/api` to the server's port, so the client keeps one
  relative URL and never learns a port.
- `web` needs the stand-in's `API_KEY` and its own matching key before it
  answers anything, and says so when either is missing.
