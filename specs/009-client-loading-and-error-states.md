---
id: SPEC-009
title: Client — loading, quote and message on screen
status: ready
primary_test_level: unit
touches: [web/src/client/, web/tests/]
---

## Intent

The brief asks for proper loading states and error messages. SPEC-006
put a form and a display area on screen for the happy path. This spec
gives the page its other two states: a request in flight, and a request
that failed.

The client renders the message SPEC-008 sends. Sorting stays on the
server, per ADR-004, and that is what lets these components be unit
tested with no network.

## Behaviours

- B1: While a quote request is in flight, the submit control is
  disabled and a loading indicator is on screen.
- B2: A quote and a message are never on screen together.
- B3: The message display renders whatever text it is given as a prop.
- B4: Submitting again clears the previous message before the new
  request starts.
- B5: The `x-request-id` header that came back with a failure is logged
  with `console.warn`. The screen shows the message alone.
- B7: On a successful quote the header still arrives, unshown and
  unlogged. A user holding a quote has nothing to report.
- B8: While either text field is empty, the submit control is disabled.
  The risk band always holds a value, so it plays no part.

## Contract

**Four states, one at a time.**

| State | Submit control | On screen |
|---|---|---|
| idle | enabled once both text fields hold a value | the form |
| loading | disabled | the form, a loading indicator |
| quote | enabled | the form, the quote |
| message | enabled | the form, the message |

`idle` → `loading` → `quote` or `message`. A second submit returns to
`loading`.

**Where the two pieces come from.** ADR-004 fixes both, and SPEC-008
builds them.

| Piece | Source |
|---|---|
| the message | `error.message` in the failure body |
| the request id | the `x-request-id` header, present on every response |

A success carries the header too. The `quote` state leaves it unshown,
because a user with a quote has nothing to report.

**The hook holds the state.** SPEC-006 puts one fetching hook in the
client; this spec adds loading and failure to it. Components stay pure
and take state and handlers as props, per ADR-002. That is the same
seam ADR-004 means when it says a component takes the mapped message
as a prop.

**The client sorts nothing.** No status code and no `code` value appears
anywhere in `src/client/`. Any non-`200` shows its `error.message` as it
arrives. A second copy of the mapping would drift from the server's.

**One string is the exception.** When `fetch` rejects there is no
response and no body, so there is nothing to display. The client holds a
single fallback for that case and no other. It is the only message text
in `src/client/`, and it is unreachable whenever `api` answers at all.

- B6: A request that never reaches `api` shows that fallback, with no
  request id, and leaves the form submittable again.

**The request id goes to the console**, one `console.warn` per
failure. Someone debugging reads it there and traces the failure
through the server log. The screen keeps the message alone, because
the id meant nothing to the person reading it.

**No new dependency.** B1 asserts on a disabled control after a submit,
which needs a real DOM. SPEC-006 already landed `jsdom` and
`@testing-library/react` for its form test, and says this spec reuses
them.

### Where each behaviour is proven

| Behaviour | Level |
|---|---|
| B1 | unit — submit against a hand-written fetch double that has not resolved, assert the control is disabled |
| B2 | unit — the display component with a quote, then with a message |
| B3 | unit — two unrelated message strings, both rendered |
| B4 | unit — fail once, submit again, assert the message is gone while loading |
| B5 | unit — a doubled response with an `x-request-id` header, a hand-written `console.warn` double records the id, and the id is off screen |
| B8 | unit — render the form empty and assert the control is disabled, fill both text fields and assert it enables |
| All of them in a browser | hand-checked — `npm start` and submit until a random failure appears. ADR-001 already records refreshing until one shows |

Every doubled thing is hand-written, per `CLAUDE.md`.

## Edge cases

| Condition | Expected |
|---|---|
| Submit clicked twice quickly | the control is disabled after the first, so the second does nothing |
| A failure follows a successful quote | the quote leaves the screen, the message takes its place |
| A message the client has never seen before | rendered as it arrives. B3 |
| The request never reaches `api` | the client's one fallback message, no request id. B6 |
| A quote comes back | the request id arrives in the header, unshown and unlogged. B7 |
| A field is emptied after a failure | the control disables again. B8 |

### Not handled

- Validating the values the user typed. ADR-004 puts validation on the
  server and SPEC-008 builds it; the client displays the answer. B8
  only asks that the fields hold something.
- A retry button, backoff, offline detection.
- Turning a field name in a message into a form label.
- Styling beyond making the four states legible. SPEC-006 already
  draws that line.
- The server-side sorting and the log — SPEC-008.

## Open questions

- (none)
