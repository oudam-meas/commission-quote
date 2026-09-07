# Specs

One unit of work each. Numbered in the order they were written.

An ADR says what was decided and why. A spec says what to build and how
you will know it works. Every spec traces to the ADR that made it
necessary, and every behaviour in it carries an ID that appears in a test
comment — so "is this covered" is a grep, and "why is it like this" is a
link.

## The map

| Spec | From | Also cites | Touches | Status | Built |
|---|---|---|---|---|---|
| [001](001-vendor-mock-bootstrap.md) Bootstrap and contract harness | ADR-001 | — | mock | ready | yes |
| [002](002-vendor-mock-auth-and-stub.md) Auth rejection and quote endpoint | ADR-001 | — | mock | ready | yes |
| [003](003-vendor-mock-pricing.md) Risk band pricing | ADR-001 | ADR-004 | mock | ready | yes |
| [004](004-vendor-mock-failures.md) Random failure simulation | ADR-001 | — | mock | ready | yes |
| [005](005-web-scaffold.md) Web scaffold and boundary | ADR-002 | ADR-003, ADR-004 | web | ready | yes |
| [006](006-web-quote-slice.md) The quote slice, happy path | ADR-003 | ADR-001, ADR-002, ADR-004 | web | ready | in progress |
| [007](007-run-modes.md) Two ways to run the app | ADR-003 | ADR-002, ADR-004 | web | ready | no |
| [008](008-api-error-categories.md) Validation, categories, deadline, logging | ADR-004 | ADR-001, ADR-002 | web server | draft | no |
| [009](009-client-loading-and-error-states.md) Loading, quote and message on screen | ADR-004 | ADR-001, ADR-002 | web client | draft | no |

**From** is the ADR that made the spec necessary. **Also cites** are ADRs
it defers to or draws a constraint from. Nearly everything cites ADR-001,
because ADR-001 holds the vendor contract.

## Tracing in either direction

**From a decision to the code.** Open the ADR, find its specs in the
table above, then grep the behaviour IDs:

```shell
grep -rn "SPEC-003/B" commission-quote-api-mock/tests/
```

**From a line of code to the reason.** Find the behaviour ID in the test
comment above it, read that behaviour in its spec, follow the spec's
`From` column to the ADR.

## Status

`draft` → `ready` → `in-progress` → `done`

A spec cannot become `ready` while its Open questions section has
entries. Only the human moves a spec to `ready`.

`draft` here means the spec is written and reviewed but not yet
promoted — the two remaining ones are waiting on a human read, not on a
missing answer. Their Open questions sections say which.

## Shape

The required sections and the house rules are in the `spec-shape` skill
at `.claude/skills/spec-shape/SKILL.md`. Two things worth repeating:

- Every behaviour is observable and independently testable, and carries
  an ID.
- Every spec assigns each behaviour a test level. A behaviour that needs
  a spawned process is hand-checked, and the spec says so rather than
  leaving the gap silent.
