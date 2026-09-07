---
id: SPEC-008
title: api — validation both directions, error categories and logging
status: ready
primary_test_level: unit
touches: [web/src/server/, web/tests/]
---

## Intent

The happy path through `api` already works. This spec makes `api` the
trust boundary: it checks what the browser sends and what the vendor
returns, sorts failures into categories, and logs a request id and any
failure nothing here already accounts for. The screen is a later spec.

## Behaviours

B9 and B11 are retired — see Rationale. Numbering below keeps every
surviving ID stable against the test comments that already cite it.

- B1: A vendor `5xx` answers `502`.
- B2: A vendor `401` or `403` answers `502`, byte-identical to B1.
- B3: A vendor `504` answers `503`.
- B4: The vendor client's own deadline elapsing answers `503`,
  byte-identical to B3.
- B5: A request failing inbound validation answers `400`, naming the
  first bad field.
- B6: A request failing inbound validation makes no vendor call.
- B7: A vendor `200` whose body fails the outbound contract answers
  `500`.
- B8: Every `POST /api/quote` response carries an `x-request-id` header.
- B10: Nothing this app logs ever carries the api-key.
- B12: Something thrown that is not one of the categories above answers
  `500` with a generic message, not the error's own.
- B13: That same thrown value is logged with its trace, for debugging —
  the browser never sees it.
- B14: A vendor status other than `200` has its raw response body logged
  — unparsed, never sent to the browser, and never part of the thrown
  response.
- B15: A `200` body failing the outbound contract has the names of its
  failing fields logged.

## Contract

**Category from outcome.** Matched in this order.

| Outcome | Category | Decided by |
|---|---|---|
| vendor `504` | timeout | `services/quote-service.ts` |
| any other vendor status, including `401`/`403` | vendor error | `services/quote-service.ts` |
| the vendor client's own deadline elapsing | timeout | `services/quote-service.ts` |
| a `200` body failing the outbound contract | invalid response | `services/quote-service.ts` |
| inbound validation failure | invalid request | `middleware/validate-quote-request.ts` |

`quote-service.ts` asks one question about a vendor status: is it `504`?
Everything else — a `5xx`, a `401`/`403`, any other unexpected status —
is one `vendor-error` category, because the browser gets the same `502`
either way (B2). A `200` whose body breaks the outbound contract is its
own category, `invalid response`, not `vendor error` — the vendor
answered fine, our own contract check is what failed. An inbound
validation failure never reaches `quote-service.ts` at all:
`validate-quote-request.ts` throws its own `HTTPException` and never
calls `next()`. All three throw the same class; `app.ts` does not care
which one raised it.

**Response to the browser.**

| Category | Status | `code` | Message |
|---|---|---|---|
| vendor error | `502` | `VENDOR_UNAVAILABLE` | `Service unavailable. Please try again. This is a simulated vendor failure.` |
| timeout | `503` | `VENDOR_TIMEOUT` | `The quote service did not answer in time. Please try again. This is a simulated vendor failure.` |
| invalid request | `400` | `INVALID_REQUEST` | see the inbound table |
| invalid response | `500` | `INVALID_RESPONSE` | `Service unavailable. Please try again. This is a simulated vendor failure.` |
| unexpected | `500` | `INTERNAL_ERROR` | `Something went wrong. Please try again.` |
| body too large | `413` | `PAYLOAD_TOO_LARGE` | `Request body is too large.` |

The three vendor-facing messages above carry one extra sentence, `This
is a simulated vendor failure.`, appended because the vendor is
ADR-001's stand-in — see Rationale.

`body too large` is not specific to `/api/quote` — `bodyLimitMiddleware()`
is mounted on every route, ahead of anything else, so no handler ever
runs against a body over 10,000 bytes. A valid quote request is a few
dozen bytes; this is headroom against a large request tying up memory,
not a real ceiling on legitimate use.

```json
{ "error": { "code": "VENDOR_UNAVAILABLE", "message": "…" } }
```

`x-request-id` rides on every `POST /api/quote` response, success
included. The `200` body stays `quoteId`, `commissionRate`,
`totalCommission`.

**Inbound validation.** Bounds are inclusive.

| Field | Rule |
|---|---|
| `loanAmount` | integer cents, `100_000` to `1_000_000_000` |
| `loanTermInMonths` | integer, `1` to `480` |
| `riskBand` | exactly `LOW`, `MEDIUM` or `HIGH` |

The message is zod's own message for the first issue `loanDetailsSchema`
reports — not hand-authored. Zod checks an object's fields in the order
they are declared, so "first bad field" means `loanAmount`, then
`loanTermInMonths`, then `riskBand`. A body that is not an object at all
produces one issue on the whole value, with zod's own wording for that.

**Outbound contract.**

| Field | Rule |
|---|---|
| `quoteId` | a non-empty string |
| `commissionRate` | a number above `0` and below `1` |
| `totalCommission` | a non-negative integer |

**Files**

| Path | Holds |
|---|---|
| `src/server/contracts.ts` | both schemas, inbound and outbound |
| `src/server/errors/error-response.ts` | the `{ code, message }` shape a failure's `HTTPException` carries in `cause` |
| `src/server/services/validation.ts` | runs both schemas, turns an inbound failure into a message and an outbound failure into the field list |
| `src/server/middleware/validate-quote-request.ts` | parses the body, runs inbound validation, throws `HTTPException` and never calls `next()` on failure. On success, sets the valid body on context as `requestBody` |
| `src/server/services/quote-service.ts` | takes an already-valid body, calls the vendor, runs outbound validation. Logs a `VendorStatusError`'s raw body — B14 — or a contract failure's field names — B15 — then throws `HTTPException` on any failure; returns the 200 body on success |
| `src/server/vendor/client.ts` | the vendor call, and its own deadline. A non-`200` response carries its raw body as `cause`, for the log only |
| `src/server/middleware/body-limit.ts` | rejects a body over 10,000 bytes on every route, before anything else runs |
| `src/server/app.ts` | reads `requestBody` off context, calls `quote-service.ts`, catches every failure in one `onError` and writes the response |

**What happens on a failure.** Everything that can fail throws
`HTTPException` (from `hono/http-exception`) — `validate-quote-request.ts`
for a bad body, `quote-service.ts` for anything about the vendor — with
`status` set directly and `cause` carrying an `ErrorResponse`
(`{ code, message }`) already decided at the point the failure is known.
`app.ts`'s `onError` is the one place anything becomes a response, and
it does not classify anything; it catches once:

- an `HTTPException` with a `cause` becomes that status and `{ error:
  cause }` as the JSON body. `onError` itself logs nothing about it —
  the status and category already say what an operator needs. Two
  exceptions, both logged by `quote-service.ts` before it ever builds
  the `HTTPException`, because the detail exists nowhere else and
  `onError` never sees it: a `VendorStatusError`'s own raw body — B14
  — and a contract failure's field names — B15. Neither rides on the
  `HTTPException` it throws next, which carries only `{ code, message }`.
- anything else — including an `HTTPException` with no `cause`, which
  should not happen from our own code but is not assumed impossible —
  is unexpected — B12 — becomes the generic `500`, and is logged with
  its trace — B13 — because a value the app cannot name is the one case
  nothing else records it.

**Values**

| | |
|---|---|
| Deadline | 3 seconds, held by `vendor/client.ts` — ADR-003 holds why |
| Request id | `crypto.randomUUID()`, via `hono/request-id`'s default generator, mounted on every route |

**Boundary log.** This app logs exactly three things of its own:

- an unexpected thrown value, with its trace, from `app.ts`'s `onError`
  — B13.
- a `VendorStatusError`'s raw body, from `quote-service.ts`, whenever
  the vendor answers anything other than `200` — B14. This runs before
  the `504`/timeout split, so it covers every non-`200` status alike.
- the failing field names, from `quote-service.ts`, whenever a `200`
  body breaks the outbound contract — B15.

Every other known failure — an invalid body, the vendor client's own
deadline elapsing — is not logged at all; its status and `cause`
already say everything an operator needs, and that only ever lives in
the response.

Everything else — the incoming request, the response status, the
timing, on every route including `GET /health` — is `hono/logger`'s
job, mounted once at the top of the app. It knows nothing about
`x-request-id` or categories; it is generic HTTP tracing, not this
spec's concern.

**Dependencies**

`zod`.

## Verification

| Behaviour | Level | How |
|---|---|---|
| B1, B2, B3, B4, B7 | unit | `processQuoteRequest`, one vendor double per case; assert what it throws or returns |
| B1, B2 | integration | the endpoint, a `5xx` and a `401`; assert both produce byte-identical responses, not just the same category |
| B5, B6 | integration | the endpoint, an invalid body per bad field; `validateQuoteRequest` needs a real Hono `Context`, so this runs through `createApp(...).request(...)` rather than a fake one |
| B8 | integration | the endpoint, header on a success and on a failure, differing between requests |
| B12 | integration | a vendor double that throws a plain `Error`; assert `500` and the generic body, not the error's own message |
| B13 | integration | same test as B12; spy on `console.error` and assert it was called with the thrown value |
| B14 | unit | `vendor/client.ts`: a fetch double answering non-`200` with a body; assert the body lands on `VendorStatusError.cause`. `quote-service.ts`: spy on `console.error`, assert it was called with the raw error, and assert the thrown `HTTPException`'s `cause` never contains it |
| B15 | unit | same B7 double, a `commissionRate` of `12`; spy on `console.error` and assert it was called with the failing field name |
| B10 | human | `npm start`, point `VENDOR_URL` at a service answering `500` with a body, submit one quote, read the server output. The vendor body appears — B14 — the api-key never does |
| both schemas | unit | one case per row, each bound from either side |
| the vendor client's own deadline | unit | a fetch double that never resolves until it is aborted, against the real 3-second deadline |

Integration coverage for B3, B4 and B7 stays deliberately thin: no
dedicated case, covered only incidentally by the success/failure pair
`quote-endpoint.test.ts`/`quote-request-id.test.ts` already exercise.
B1 and B2 get one HTTP case each — not because the category matrix
needs proving twice, but because B2's own claim is that a `401` and a
`5xx` are *byte-identical* over the wire, which a unit test against
`processQuoteRequest` can't show on its own: two unit tests can each
assert `status: 502` without ever proving the two responses are
identical to each other, let alone identical once they've passed
through `context.json()` and back out as real bytes. The rest of the
matrix is unit-level, against `processQuoteRequest` directly, where a
case is a function call and a fake vendor client rather than a full
request.

B5 and B6 are the exception: they test `validateQuoteRequest`, a Hono
middleware, which needs a real `Context` to run at all — there is no
cheaper way to call it than through the route.

B12 and B13 are integration-only, and the same test proves both: it
proves the route's own catch-all — what happens when the thrown value
is not an `HTTPException` at all — and that catch does not exist inside
`processQuoteRequest`.

Doubles are hand-written.

## Main session owns

- `web/package.json` — `zod` as a runtime dependency

## Edge cases

| Condition | Expected |
|---|---|
| `loanAmount` exactly `100_000` or `1_000_000_000` | accepted |
| `loanTermInMonths` of `0` or `481` | `400` naming that field |
| Both `loanAmount` and `riskBand` bad | `400` naming `loanAmount` |
| `commissionRate` of exactly `0` or `1` | `500` |
| Vendor returns `400` | `502` |
| Vendor answers just after the vendor client's deadline | `503` |

### Not handled

- Everything the browser renders.
- Retry, backoff, circuit breaking.
- A contract test for a failure path.
- Sending the request id to the vendor.
- Log levels, structured output, shipping.
- Any change to the mock.

## Open questions

- (none)

---

## Rationale

**The simulated-vendor-failure sentence exists because the vendor is a
stand-in, not a real dependency (ADR-001).** A user hitting a genuine
vendor outage has no way to tell it apart from this app deliberately
failing on purpose — the sentence removes that doubt. It drops out with
the stand-in itself, once a real vendor exists to fail for real reasons.
`INTERNAL_ERROR` carries no such sentence: an unexpected bug is not the
vendor's doing, simulated or not.

**`504` is matched before the catch-all** because a `504` is also a
`5xx`. ADR-004 puts a vendor `5xx` and a `4xx` we caused on one row, so
the catch-all carries both plus any unexpected status.

**A `200` never goes through the vendor-status check.** It goes to the
contract check instead, and a failure body is never parsed — `api` reads
the vendor's status code and nothing else.

**A `401` gets the same response as a `5xx`** because the user sees the
same message and has no action either way. A `401` to the browser would
suggest their own session had expired. The cost: the message invites a
retry that cannot help the auth case. ADR-004 accepts that. They are the
same category too, not just the same response — see the "vendor auth
folded into vendor error" note below.

**The messages are chosen here.** ADR-004 fixes the status and the code
and writes no user-facing text.

**Validation stops at the first failure** so the `400` is deterministic
and a doomed request never reaches the vendor. The amount reads in
dollars because that is what the user types.

**One schema file, read in both directions**, so the contract is written
once. ADR-002's flat `src/server/` listing names no schema module. This
adds one file rather than a layer, and departs from that sketch.

**Validation split from shaping**, first. `quote-service.ts` shrank to
shaping the 200 body once `services/validation/` took over running both
schemas, and the request-rejecting logic moved out of `app.ts` into its
own middleware file. One job per file.

**Superseded: orchestration moved into the service.** That split still
left the route calling `errors/categories.ts` and shaping the response
inline, so proving B1–B4, B6 and B7 needed a live `app.request()` call
to reach that logic — the middleware and the route together held all
of it, and neither could be exercised without the other. `quote-service.ts`
now owns the whole request: inbound validation, the vendor call, outbound
validation, one outcome value out. The route's job shrank to reading the
body, calling the service once, mapping its outcome to a status and body,
and writing the log lines. Six behaviours moved to a plain function call
against a fake vendor client, no HTTP layer in the way. What is left at
the route is exactly what an outcome value cannot prove by itself: the
real header, the real status code on the wire, and the log line's exact
text — B8 through B11.

**Superseded again: the service throws instead of returning.** Returning
an outcome value stopped the route from re-deriving a category, but the
route still matched on `kind` to pick a status and a body — one switch
in place of several. `quote-service.ts` now threw a custom `HttpError`
with the status, the `code` and the message already attached — later
replaced by `HTTPException`, below — so the route's job shrank to one
catch: read those fields off whatever was thrown, or answer the generic
`500` when it did not match at all — B12.

**Superseded again: inbound validation moved back out of the service.**
The service throwing for a bad body worked, but it meant "was this ever
a real quote request" and "did the vendor answer it correctly" lived in
the same function. Inbound validation moved to `validate-quote-request.ts`,
a middleware that parses the body, validates it, and answers `400`
itself — the service never sees a request that hasn't already passed.
It sets the valid body on context as `requestBody` rather than
reparsing it, so the parse happens once. The cost: B5 and B6 can no
longer be proven against a plain function call, because a Hono
middleware needs a real `Context` — they moved from unit to integration.

**Superseded again: vendor auth folded into vendor error.**
`errors/categories.ts` sorted a vendor status into three categories, but
`vendor-auth` and `vendor-error` always produced the same `502` — the
only difference was one word in a log line since removed (see below).
`quote-service.ts` now asks one question directly, `status === 504`,
and `errors/categories.ts` is gone.

**Superseded again: known failures stopped being logged.** Every known
failure — vendor error, timeout, an outbound contract break, an invalid
request — was once logged with its category and detail, on the theory
that an operator would want the full boundary traced. In practice a
known failure's category and status are already sitting in the response
next to `x-request-id`; logging them again duplicated what the response
already says, for cases where nothing was actually wrong with the app.
Only a genuinely unexpected thrown value — B12 — has no other record of
itself anywhere, so only it gets logged, with its trace, as B13. B11 is
gone outright: there is no outcome log line left for it to name a field
on.

**Superseded again: inbound validation throws too, and stopped logging
itself.** `validate-quote-request.ts` used to answer its own `400` and
log two lines of its own — the one asymmetry left where a failure did
not go through one shared exception type and `onError` like everything
else. It now throws the same way `quote-service.ts` does, so `app.ts`
has exactly one path from a thrown failure to a response, regardless of
where it was decided. Its own logging is gone for the same reason every
other known failure stopped being logged: the response already says
what happened, and `hono/logger` already logs that a request came in
and what it got back. B9 is retired outright — there is no longer a
custom "incoming request" line for an id to appear on.

**Superseded again: `HttpError` replaced with Hono's own `HTTPException`.**
A hand-rolled `Error` subclass held `status`, `code`, `message` and three
fields nothing ever ended up reading — `category`, `vendorStatus`,
`fieldNames` — write-only ceremony left over from when failures were
logged in detail. `HTTPException` (`hono/http-exception`) is the
framework's own type for exactly this: a deliberate, known HTTP failure.
It has no `code` field of its own, so `code` and `message` travel
together as an `ErrorResponse` in its standard `cause` option instead —
`onError` reads `raised.cause` and spreads it straight into the body.
One fewer hand-rolled class, one framework type recognisable to anyone
who has read Hono's own docs, and no more fields carried only to be
unused.

**The vendor client holds the deadline, not the route.** ADR-003 says
why: production code should not be shaped around a test double's
limits, and the double now honours the abort signal instead of
production code working around it.

**Superseded again: one catch, not two.** The vendor client used to
catch its own `fetch` call and translate `AbortSignal.timeout()`'s
`DOMException` into a `VendorTimeoutError` it threw instead — a second,
separate translation layer alongside `quote-service.ts`'s own catch
around the vendor call. `vendor/client.ts` no longer catches anything
of its own; the `DOMException` propagates unchanged, and
`quote-service.ts` recognises it directly, the same place it already
recognises `VendorStatusError`. One catch instead of two, at the cost
of `quote-service.ts` now knowing a `fetch`-level detail —
`AbortSignal.timeout()` fails this specific way — that `VendorTimeoutError`
used to hide behind a domain name. `VendorStatusError` is unaffected: a
non-200 response is still a plain conditional throw in the vendor
client, never a catch, so there was nothing to consolidate there.

**Reversed: a vendor error body is now logged, unparsed.** A vendor
`5xx` used to be a dead end — the status sorted it into a category, and
whatever the vendor actually said (a stack trace, an error page) was
discarded unread. That traded away real debugging value: the status
says *that* the vendor failed, never *why*. `VendorStatusError` now
carries the raw body as `cause`; `quote-service.ts` logs it before
building the `HTTPException` the browser sees. This reverses an earlier version of this decision, which once stated
flatly that the app never parses a vendor error body — which is why it
is said here explicitly rather than changed quietly. What did not change: the body is read as text, never as JSON,
never validated, and never rides on the `HTTPException`'s own `cause`
— only `{ code, message }` does. A vendor sending back something
hostile in a `5xx` body reaches a log line an operator reads, never a
response a browser renders.

**Reversed: an outbound contract break is `invalid response`, not
`vendor error`, and its fields are logged.** A `200` body breaking our
own contract used to answer `502`/`VENDOR_UNAVAILABLE`, sharing both
the status and the category with an actual vendor failure — B11
retired the log line that once named which field broke, on the theory
that nothing was left that could name it. That conflated two different
problems: a `5xx` means the vendor failed; a `200` that fails our shape
check means the vendor answered but the shape is wrong, which is at
least as much a contract question as a vendor-availability one. It now
answers `500`/`INVALID_RESPONSE` — sharing a status with B12's
catch-all but never its code — and `quote-service.ts` logs which
fields failed — B15 — the same way B14 logs a `VendorStatusError`'s
body: computed already, discarded before, now actually used. The
`fieldNames` `validateQuote` already returned were dead data until this
change; they are what B15 logs.

**`503`, not `504`, for our own timeout.** A gateway in front of us can
also answer `504` when it gives up on us. Reusing that status here would
blur the two together in anything watching from outside.

**`GET /health` is excluded** because a liveness check has nothing to
trace.

**The log is hand-checked** because capturing stdout sits outside the
three test levels, and a fourth level is not worth adding here.
