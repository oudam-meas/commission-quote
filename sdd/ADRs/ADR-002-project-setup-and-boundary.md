# ADR-002: Project setup and the web/mock boundary

**Status:** Accepted
**Date:** 2026-09-07

## Context

Two things ship: the web app and the vendor stand-in. How separate should
they be, and where do the seams go?

## Decision

Two packages, not three:

```
commission-quote-app/
├── web/                          # UI + API, one process
│   ├── src/client/               # React, Vite
│   └── src/server/               # Hono, holds the api-key
└── commission-quote-api-mock/    # standalone, own node_modules
```

The UI and the API sit together because the `api-key` forces a server side.
A browser can't hold a secret. So `src/server/` holds the key, and nothing
else needed a second deployable. The trust boundary is still real: the
browser talks to `src/server/` over HTTP either way, sharing a folder
doesn't mean sharing a process.

The mock is fully separate: its own `package.json`, its own `node_modules`,
no shared workspace. It gets deleted when the real vendor ships, so a
physical boundary means an accidental import gets noticed instead of
slowly eroding. The cost is two installs instead of one.

No Docker, no Kubernetes. Three node processes started with `concurrently`
is simple enough for now.

No service layer inside `src/server`, no repository, no DTO mappers. At
this size they'd be ceremony. On the client, one hook does the fetching,
and the components stay pure and take handlers as props, so they can be
unit tested without a network.

## Testing

Three levels, nothing else. Unit tests cover one module at a time, no
HTTP. Integration tests treat the `api` endpoints as a black box, with the
vendor client swapped for a hand-written double, one test per error
category. Contract tests are ADR-001's job.

Doubles are hand-written, no mocking library, so a reviewer can see
exactly what's faked. The vendor client goes in through the constructor,
so that seam is visible in the code instead of hidden in test config. No
end-to-end tests — out of scope for the timebox.

## Consequences

- Deleting `commission-quote-api-mock/` must leave `web` compiling. That's
  how the boundary gets checked.
- Nothing outside `vendor/` calls the vendor. Nothing in `src/client/`
  references the api-key or the vendor URL.
- `.env` is gitignored, `.env.example` is committed.

The "no service layer" call didn't survive. The route handler's own body
grew past validating a request, calling the vendor, and shaping a
response. Then the service that grew out of it grew past one job too.
Both times, the piece that outgrew a scaffold got its own file.
