# Commission Quote App

A web app that captures loan details and returns a commission quote.
`commission-quote-api-mock` stands in for the real Commission Quote API.

My personal defaults live in `~/.claude/CLAUDE.md` and apply here. This
file holds what is specific to this repo.

## Commands

```
npm install && npm run install:all
npm start              # mock, web server and Vite together
npm run dev            # web alone, against the dev double
npm test               # unit and integration, both packages
```

Per package: `npm start`, `npm test`, `npm run typecheck`. The mock also
has `npm run test:contract`, kept out of `npm test` because it makes real
HTTP calls against a live process.

Only add a script here after running it.

## Structure

Two standalone packages, no npm workspaces, so the mock can move to its
own repo later.

- `commission-quote-api-mock/` — own process and port. Stands in for the
  vendor.
- `web/` — `src/client/` (React, Vite) and `src/server/` (Hono, holds the
  vendor `api-key`). Split tsconfigs, because the two halves need
  different compiler settings.
- Root `package.json` holds no code. It starts the processes and fans
  tests out. Installs stay per package.

## Invariants

- Money is integer cents. Never float.
- The `api-key` never reaches `src/client/`.
- The mock imports nothing from `web/`, and the other way round.
- Specs change before code changes.
- No raw vendor errors reach the user.

## Write access

| Agent | Writes to | Never writes to |
|---|---|---|
| Main session | `specs/`, `ADRs/`, project-level files | — |
| `test-writer` | `tests/` | `src/` |
| `implementer` | `src/` | `tests/` |
| `requirement-gaps` | — read-only | — |

Project-level means anything outside a spec's `touches` — root
`package.json`, READMEs, `.gitignore`, CI, package scaffolding. No agent
creates them. If the main session does not, nobody does.

If `implementer` believes a test is wrong, it stops and reports. It does
not edit the test.

`test-writer` never calls `implementer` itself. It names the behaviour
IDs it covered and waits.

These are conventions, not guarantees. A one-file edit the main session
can just do; a change spanning several files goes to `implementer`.

## The loop

Agent definitions live in `.claude/` and are not committed. The roles:

1. Read the current state before writing anything.
2. Name the spec, e.g. SPEC-002/B3.
3. Tests and implementation are written by separate hands. Whoever
   writes src does not edit a failing test to make it pass — it stops
   and reports instead.
4. Check your own prose and naming after writing. Report, don't fix.
5. Run the tests.
6. Report, citing spec IDs and file paths.

Passing tests are not done. A spec is done when someone who has not seen
the code can start it and run its tests from a README.

## Testing here

Integration means `web`'s endpoints with the vendor client swapped for a
double — one per error category. Contract means a real HTTP call to
`VENDOR_URL`.

The behaviour ID goes in a comment above each test, e.g.
`// SPEC-001/B3`.

## Specs

`draft` → `ready` → `in-progress` → `done`

No spec becomes `ready` while Open questions has entries. Only I move a
spec to `ready`.
