---
id: SPEC-007
title: Two ways to run the app
status: ready
primary_test_level: unit
touches: [web/src/, web/tests/, web/dev/]
---

## Intent

Make the app startable two ways, as ADR-003 decided. `npm run dev` runs
`web` alone against a vendor double, so the UI can be built without the
stand-in and without fighting its 20% failure rate. `npm start` runs
every process, so the whole path can be exercised from a browser.

## Behaviours

- B1: The dev double answers a quote request with a successful, priced
  response, matching the vendor's shape.
- B2: `npm run dev` starts `web` wired to the double, with no `API_KEY`
  and no stand-in running.
- B3: `npm start` at the root starts the stand-in, `web`'s server and
  Vite together.
- B4: The browser reaches the server through a relative `/api` URL in
  both modes.
- B5: Nothing under `web/src/` imports from `web/dev/`. Deleting
  `web/dev/` and its tests together leaves `web` typechecking and every
  remaining test passing.

## Contract

**The double lives outside `src/`.** `web/dev/` sits beside it. `dev/`
imports from `src/`; nothing under `src/` imports from `dev/`. The
production build compiles `src/` alone, so the double has no route into
a shipped bundle. B5 is what proves that boundary held.

`web/dev/vendor-double.ts` exports `createVendorDouble()`, returning the
same `VendorClient` shape `createApp` takes — matching `createApp` and
`createVendorClient`.

Its own test lives in `web/tests/unit/dev/`, and both folders are checked
by `tsconfig.server.json`. The boundary is one-directional, so deleting
`web/dev/` means deleting that test with it.

**Two entry files, no mode flag.** `src/server/index.ts` builds the app
with the real vendor client. `dev/main.ts` builds it with the double.
The npm script picks the file. There is no `NODE_ENV` branch inside the
server, so shipped code never asks which mode it is in.

This reuses the constructor seam ADR-002 already created for the
integration tests, which is why the second run mode costs one small file.

**The dev double is its own file, separate from the test doubles under
`web/tests/`.** A test double pins one outcome per case. The dev double
always succeeds. Sharing them would mean one file serving two purposes
and drifting for both.

**The root `package.json` arrives here.** No `src/`, no tests, no ports,
no env vars. `concurrently` is its only dependency, already chosen in
ADR-002 — one line, labelled output, kills everything on Ctrl-C. Its
scripts call each package's own scripts and stop there. Installs stay per
package, so the two-package boundary holds and deleting the stand-in
removes one line.

**Vite proxies `/api` to the server port** in both modes, so the client
keeps one relative URL and never learns a port.

`npm run dev` needs no `.env`. `npm start` needs the stand-in's `API_KEY`
and `web`'s matching `VENDOR_API_KEY`, and says so when either is
missing.

### Where each behaviour is proven

| Behaviour | Level |
|---|---|
| B1 | unit — call the double and check the shape against the vendor's |
| B2, B3 | hand-checked — run each command, open the browser |
| B4 | hand-checked — the client's request URL is relative |
| B5 | hand-checked — move `web/dev/` and `web/tests/unit/dev/` aside, then typecheck and test still pass |

Most of this is hand-checked, because starting processes is what the
spec is about. ADR-003 states the cost plainly: a path can work under
`dev` and break under `start`. What `dev` skips is the vendor client and
its config — one module, covered by the mock's contract suite, and walked
by hand every time anyone runs `npm start`.

**Run instructions.** The root `README.md` becomes the reviewer's entry
point: install, `npm start`, open the browser. `npm run dev` is described
as the UI loop.

## Edge cases

| Condition | Expected |
|---|---|
| `npm run dev` with no `.env` anywhere | starts, every quote succeeds |
| `npm start` with a missing key | the failing process says which variable |
| Ctrl-C under `npm start` | every process stops |

### Not handled

- Making the double fail on demand. It always succeeds; failures are the
  stand-in's job under `npm start`.
- Error handling and loading states — ADR-004.
- A production build, Docker, CI.
- Any change to `commission-quote-api-mock/`.

## Open questions

- (none)
