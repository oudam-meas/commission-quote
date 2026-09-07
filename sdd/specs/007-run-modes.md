---
id: SPEC-007
title: Running the app
status: done
primary_test_level: unit
touches: [web/src/, web/tests/]
---

## Intent

`npm start` at the root starts every process, so the whole path can be
exercised from a browser.

A dev mode that ran `web` alone against a vendor double was built, then
cut. It let the UI get built without fighting the stand-in's failure
rate, but it doubled every run instruction and every server entry point
for a problem `FAILURE_RATE=0` already solves. See ADR-003.

## Behaviours

- B1: `npm start` at the root starts the stand-in, `web`'s server, and
  Vite together.
- B2: The browser reaches the server through a relative `/api` URL.

## Contract

**The root `package.json` starts things, and owns nothing else.** No
`src/`, no tests, no ports, no env vars. `concurrently` is its only
dependency, chosen in ADR-002: one line, labelled output, kills
everything on Ctrl-C. Its scripts call each package's own scripts and
stop there. Installs stay per package, so the two-package boundary
holds, and deleting the stand-in removes one line here.

**Vite proxies `/api` to the server port.** The client keeps one
relative URL and never learns a port.

`npm start` needs the stand-in's `API_KEY` and `web`'s matching
`VENDOR_API_KEY`, and says so when either is missing.

## Verification

| Behaviour | Level | How |
|---|---|---|
| B1 | human | run the command, open the browser |
| B2 | human | the client's request URL is relative |

Both are human because starting processes is what this spec is about.

## Main session owns

- root `README.md` — the reviewer's entry point: install, `npm start`,
  open the browser

## Edge cases

| Condition | Expected |
|---|---|
| `npm start` with a missing key | the failing process says which variable |
| Ctrl-C under `npm start` | every process stops |

### Not handled

- A dev mode against a double. Cut — see Intent.
- Error handling and loading states. ADR-004.
- A production build, Docker, CI.
- Any change to `commission-quote-api-mock/`.

## Open questions

- (none)
