# ADR-002: Project setup and the web/mock boundary

**Status:** Accepted
**Date:** 2026-09-05

## Context

Two things ship. The web application, and the stand-in for the vendor. The
brief treats them as separate deliverables and so do I.

The question is how separate they should be, and where the seams go.

## Decision

### Two packages, not three

```
commission-quote-app/
├── web/                          # UI + API, one process
│   ├── src/client/               # React, Vite
│   └── src/server/               # Hono, holds the api-key
└── commission-quote-api-mock/    # standalone, own node_modules
```

### Why the UI and the API sit together

The brief calls this a full-stack web application. The api-key requirement is
what forces a server side. A browser cannot hold a secret. Anyone who loads the
page can read the bundle.

So `src/server/` exists to hold the key. Nothing else needed a second
deployable, so I did not make one. One package, one process.

The trust boundary is still real. The browser talks to `src/server/` over HTTP
either way. Sharing a folder does not mean sharing a process.

### Why the mock is fully separate

It has its own `package.json` and its own `node_modules`. There is no npm
workspace covering both.

The stand-in gets deleted when the real vendor ships. Keeping it physically
separate means an accidental import is not possible without noticing. If they
shared a workspace, that boundary would slowly erode.

The cost is that the reviewer runs two installs. That is two lines in the
README.

### No Docker, no Kubernetes

The brief asks for simple run instructions. Three node processes, started
together with `concurrently`. Containers go in the README under next steps.

### Inside src/server

```
routes/quote.ts       validate, call vendor, respond
vendor/client.ts      the only place that knows the vendor exists
money/cents.ts        pure, most tested, smallest
errors/categories.ts
config.ts
```

No service layer, no repository, no DTO mappers. At this size they would be
ceremony.

### Inside src/client

One hook does the fetching. The components are pure and take handlers as props.
That is what lets me unit test them without a network.

## What confidence looks like

Three levels of test. Nothing else.

- **Unit** — one module at a time. UI components, server modules, mock modules.
  Pure, no HTTP.
- **Integration** — the `api` endpoints as a black box, with the vendor client
  swapped for a double. In-process through Hono's `app.request()`. One per
  error category.
- **Contract** — see ADR-001.

Doubles are written by hand. No mocking library. A reviewer can then see exactly
what is faked.

The vendor client goes in through the constructor. That keeps the seam visible
in the code instead of hidden in test config.

Test descriptions read as plain language describing the feature. The behaviour
ID goes in a comment above the test.

No end-to-end tests. Out of scope for the timebox.

## Consequences

- Deleting `commission-quote-api-mock/` must leave `web` compiling. That is how
  I check the boundary held.
- Searching `src/client/` for the api-key or the vendor URL must return
  nothing. The same goes for searching outside `vendor/` for a call to the
  vendor.
- `.env` is gitignored. `.env.example` is committed.
- Two installs, three processes, one `npm run dev` at the root.

Superseded in part by ADR-003: `npm run dev` starts two processes against a
vendor double, and `npm start` starts all three.

Superseded in part: the single route handler grew past validating a
request, calling the vendor, and shaping a response, all in one file.
The "no service layer" line above was right for a scaffold with one
route. It stopped being right once that route's own body needed a name
of its own.

Superseded again: that layer itself grew past one job. Validation and
request-rejection each needed a home separate from where the vendor
call and the response shaping lived.
