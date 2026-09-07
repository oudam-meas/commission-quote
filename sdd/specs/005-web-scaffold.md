---
id: SPEC-005
title: Web package — scaffold and boundary
status: done
primary_test_level: unit
touches: [web/src/, web/tests/]
---

## Intent

Stand up `web/` as its own runnable package, the way SPEC-001 stood up
the mock. The server answers a health check. The client renders a
placeholder page. No quote logic.

The shape comes from ADR-002 and the reasons stay there. `src/server/`
exists because the `api-key` has to live where a browser cannot read it.

## Behaviours

- B1: `web`'s server start script listens on `PORT`, default `4001`, and
  prints the bound port.
- B2: `GET /health` returns `200` with a JSON body.
- B3: The client's root component renders `Commission Quote App` as its
  heading, and Vite serves it on `5173`. The text matches the root
  `README.md` title and `index.html`'s `<title>`. It is a placeholder for
  the form.
- B4: Each half typechecks under its own tsconfig, and one script runs
  both.
- B5: Nothing under `web/` imports from `commission-quote-api-mock/`.

## Contract

```
web/
├── src/client/     React, Vite entry
├── src/server/     Hono. app.ts builds the app, index.ts binds the port
└── tests/unit/     client/ and server/, split so each tsconfig covers one
```

| | |
|---|---|
| Server port | `PORT`, default `4001` |
| Client port | Vite, `5173` |
| Health path | `GET /health`, returning `{ "status": "ok" }` |

Ports come from the root `README.md`. The health path mirrors the mock's,
so both processes are checked the same way — no ADR names one for `web`.

**Two tsconfigs, no base config.** `tsconfig.server.json` for Node and
NodeNext, `tsconfig.client.json` for DOM and bundler resolution. ADR-002
fixed this. The point is that a React import inside `src/server/` fails
`typecheck`. A bare `tsc` finds nothing here on purpose, so neither half
can be checked under the other's settings. The cost is two files to keep
in step.

Match the mock's tsconfig where nothing argues otherwise, and set
`"type": "module"` — NodeNext resolves imports differently without it.

**Building the app is separate from serving it**, mirroring the mock, so
B2 runs through `app.request()` with no port bound. ADR-003 fixes the name
`src/server/main.ts`, later renamed to `index.ts`.

**Scripts.** Enough to start each half, run the unit tests, and typecheck
both halves in one command. Names should match the mock's where the job is
the same. No `test:int` yet: integration needs an endpoint and a vendor
double, and both arrive with ADR-003.

**No request logger.** ADR-004 owns `web`'s logging and puts it at the
boundary with a request id. Adding one now would guess at that.

**Config.** `PORT` only, with a safe default, read directly. ADR-002 names
a `config.ts`; it arrives with ADR-003's `VENDOR_URL` and
`VENDOR_API_KEY`, which have no safe default and do need to raise. A
module wrapping one optional lookup would have one caller and nothing to
decide.

`web/.env.example` is committed and `.env` is gitignored, per ADR-002.

**Dependencies.** React, Vite and Hono are named in `CLAUDE.md`. Add
`@hono/node-server` because Hono binds no Node port alone, `tsx` for the
same reason SPEC-001 records, `@vitejs/plugin-react` so Vite and Vitest
compile JSX, plus Vitest, TypeScript and the matching `@types`. Anything
beyond that list needs its own line here.

Added later: `@picocss/pico`, imported once in `main.tsx` as its
classless build. It styles the semantic tags the components already
render, so the UI gets a readable look with no class names and almost
no CSS of our own to maintain — `index.html` still carries a dozen
lines of layout CSS (centering the column, capping its width), because
Pico styles elements, not page layout.

## Verification

| Behaviour | Level | How |
|---|---|---|
| B1 | human | start it, read the port it prints |
| B2 | unit | `app.request('/health')`, in process |
| B3 component | unit | render the component to a string and assert the heading. No DOM environment, no testing library — it shows markup and can never show a click; ADR-003's form needs real events and records what it adds |
| B3 in a browser | human | open `http://localhost:5173` |
| B4 | human | the typecheck script exits zero |
| B5 | human | grep, and typecheck still passes with the mock folder moved aside |

Four rows are human: starting a process, exiting a compiler and
deleting a folder all sit outside the three test levels. They are
one-line commands, listed in `web/README.md`.

## Main session owns

- `web/package.json`, the tsconfigs, `vite.config.ts`, `index.html`,
  `.env.example`
- `web/README.md` — install, start both halves, run the tests
- root `README.md` — the line saying `web/` is unbuilt is replaced

## Edge cases

| Condition | Expected |
|---|---|
| `PORT` unset | listens on `4001` |
| `.env` absent | starts on the default port |
| `GET /health` with no headers | `200`. This server checks no key yet |
| Unknown path | Hono's default `404` |

### Not handled

ADR-003, the first slice: the quote form and display, `POST /api/quote`,
the vendor client and anything reading `VENDOR_URL` or `VENDOR_API_KEY`,
the dev double and second entry file, Vite's `/api` proxy, the root
`package.json` and `concurrently`, `tests/integration/` and `test:int`.

ADR-004, error handling: the categories and their mapping, the outbound
timeout, UI loading and error states, boundary logging and the request id.

Also out: `config.ts`, `money/cents.ts` and `errors/categories.ts` — each
arrives with the code that needs it. Request validation. A production
build of the client. Docker and CI.

## Open questions

- (none)
