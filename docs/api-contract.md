# Purchase Approval — API Contract

**Status: FROZEN by task T01.** Do not change this file, `docs/openapi.yaml`, `testdata/validation-cases.json`, `frontend/src/copy.ts` or `docs/seed-spec.md` in an implementation task. If you believe one is wrong, stop and report.

Sources: `docs/PRD.md` (behavior) and `docs/implementation-plan.md` (decisions D-xx). `docs/openapi.yaml` is the machine-readable form of sections 3–5 and must agree with this file.

## 1. Conventions

* Base path `/api/`. Requests and responses are JSON (`Content-Type: application/json`), UTF-8. Any other content type on a body-carrying endpoint gives 400 `validation_error` (field `_body`, code `invalid_format`).
* Every `/api/` response, success or error, carries `Cache-Control: no-store` (D-22).
* **Money** is a JSON string with exactly two decimals (`"25.00"`). Currency is the constant `"USD"`. Never a JSON number (D-23).
* **Timestamps** are ISO 8601 UTC with a trailing `Z` and whole seconds: `2026-10-10T14:30:05Z`. The server truncates (does not round) sub-second digits when rendering. Ordering uses the stored full-precision value.
* **Ids** (`id` of users, companies, requests) are lowercase UUID v4 strings. A request's `id` is its public reference (D-03).
* Unknown JSON body fields are ignored, never an error (D-19). Fields named `company`, `requester`, `role`, `status`, `decided_by`, `decided_at`, `submitted_at`, `id` have no effect anywhere.
* Only the methods in section 3 exist. Anything else on a known path gives 405 `method_not_allowed` with an `Allow` header. No `PUT`, `PATCH` or `DELETE` route exists on any path (AC-27).
* A path under `/api/` that matches no route gives 404 `not_found` (JSON). Paths outside `/api/` are served by the SPA fallback and are not part of this contract.

## 2. Authentication and CSRF

* Session cookie `sessionid` (HttpOnly, SameSite=Lax, `Secure` when `COOKIE_SECURE=true`). Sliding idle expiry, `SESSION_IDLE_SECONDS` (D-31).
* CSRF: cookie `csrftoken` (readable by JavaScript, SameSite=Lax), sent back as header `X-CSRFToken` on every `POST`. `GET /api/auth/csrf/` sets the cookie. Login rotates the token, so clients re-read the cookie before each unsafe request.
* A `POST` without a valid token gives 403 `csrf_failed`, including `login` and `logout`.
* Missing, invalid or expired session on a protected endpoint gives 401 `not_authenticated` (never 403) (D-20).

## 3. Endpoints

| Method and path | Auth | Request | Success |
|---|---|---|---|
| `GET /api/health/` | none | – | 200 `{"status":"ok"}`; 503 `{"status":"unavailable"}` when the database fails. Not part of the error format |
| `GET /api/auth/csrf/` | none | – | 204, sets `csrftoken` |
| `POST /api/auth/login/` | none | `{email, password}` | 200 `User` |
| `POST /api/auth/logout/` | session | empty | 204, session destroyed |
| `GET /api/auth/me/` | session | – | 200 `User` |
| `GET /api/requests/` | session | query `status`, `page` | 200 `RequestList` |
| `GET /api/requests/summary/` | session | – | 200 `RequestSummary` |
| `POST /api/requests/` | session | header `Idempotency-Key`; body `{title, vendor, description, amount}` | 201 `RequestDetail` (created) or 200 `RequestDetail` (replay) |
| `GET /api/requests/{id}/` | session | – | 200 `RequestDetail` |
| `POST /api/requests/{id}/approve/` | session | empty body (ignored) | 200 `RequestDetail` |
| `POST /api/requests/{id}/reject/` | session | `{reason}` | 200 `RequestDetail` |

`{id}` is matched as an arbitrary path segment, not only UUIDs, so that a malformed id yields the same 404 as an unknown id (D-10).

### 3.1 Login

* Body fields `email` and `password`, validated with `login_email` / `login_password` from `testdata/validation-cases.json`. Email is trimmed (D-25) and matched case-insensitively. Password is never trimmed.
* Missing or empty field: 400 `validation_error` with `fields`. Wrong password, unknown email or inactive account: the identical 401 `invalid_credentials` response (same status, same body, D-24). An unknown email must still spend the password-hashing time.
* Throttling (D-24), checked after body validation: once a normalized email has 10 failed attempts, or a client IP has 50, within a 15-minute window that starts at the first failure, every login for that email or from that IP gets 429 `throttled` with `Retry-After` (seconds until the window ends), even with the correct password. Validation errors and throttled attempts are not counted. Unknown and known emails are counted the same. A successful login clears that email's counter.
* Logging in while already signed in replaces the session (the old one is destroyed).
* The password never appears in any response or log line.

### 3.2 List

* Query `status`: one of `pending`, `approved`, `rejected`; absent means all. Any other value (including an empty string): 400 `validation_error`, `fields.status`, code `invalid_choice`.
* Query `page`: integer ≥ 1 written with ASCII digits (default 1). Anything else, including `0`, `-1`, `abc`, `1.5`, empty: 400 `validation_error`, `fields.page`, code `invalid_format`. A page above `page_count` is clamped to the last page and the response reports the actual `page` (D-12). Unknown query parameters are ignored.
* Visibility is applied first, then the status filter, then counting and slicing (PRD S2). An Employee sees only own requests; a Manager sees every request of their company, including their own.
* Order: `submitted_at` descending, then `id` descending (D-13). `page_size` is always 20. `page_count` is at least 1; an empty result is `count: 0, page: 1, page_count: 1, results: []`.

### 3.2a Summary

* `GET /api/requests/summary/` returns the counts behind the list's status tabs, the pending banner and the sidebar: `{all, pending, approved, rejected}`, integers ≥ 0.
* Counted over the requests visible to the caller (same visibility as the list, PRD S2), ignoring any status filter or page. `all` equals the sum of the three statuses. A malformed or unknown id in the detail route never shadows this fixed path.
* Errors: 401 `not_authenticated`, 405 `method_not_allowed`, 500 `server_error`.

### 3.3 Submit

* Header `Idempotency-Key` is required: a UUID (any version, any letter case; stored lowercase). Missing or not a UUID: 400 `validation_error`, `fields.idempotency_key`, code `required` or `invalid_format`. Fields are validated with the rules in section 6.
* Check order: authentication → CSRF → idempotency key → field validation → create or replay (plan 5.4).
* Replay (D-15): the key is unique per requester. Same key and same normalized payload (`title`, `vendor`, `description`, `amount` after validation) → 200 with the stored request, nothing created. Same key and a different normalized payload → 409 `idempotency_conflict`. A replay from a different user with the same key is a new, independent submission.
* Company, requester, status `pending` and `submitted_at` come from the session and the server only.
* On success the response is the full `RequestDetail`. Its `events` has exactly one entry (`submitted`).

### 3.4 Detail

* Looked up only among requests visible to the caller. A missing, malformed, other-company or (for Employees) other-user's id gives the identical 404 `request_unavailable` (status, `code` and `message`, no `fields`/`request`) (D-10).
* `can_decide` is true only if the caller is a Manager, is not the requester, and `status` is `pending`.

### 3.5 Decisions

Order of checks; the first failure is returned (D-18):

1. Not authenticated → 401 `not_authenticated`.
2. CSRF → 403 `csrf_failed`.
3. Request not visible to the caller (missing, malformed id, other company, Employee and not own) → 404 `request_unavailable`. This applies to Employees deciding a colleague's request too.
4. Caller is not a Manager (an Employee deciding their **own** request) → 403 `not_permitted`.
5. Caller is the requester (a Manager deciding their own) → 403 `own_request`.
6. Request row locked; status is not `pending` → 409 `already_decided`, with the current request in `error.request`. This applies to the same manager repeating the action (D-17).
7. Body validation (reject only) → 400 `validation_error`, `fields.reason`.

Success: 200 `RequestDetail` with the new status, `decided_by`, `decided_at` (one timestamp), and for rejection `rejection_reason`. `events` then has two entries. A failed or rejected attempt never changes the request.

* `approve`: body ignored (may be empty or any JSON).
* `reject`: body `{reason}`, validated as `rejection_reason` (1–1,000 code points after trimming, multiline).

## 4. Shapes

All fields are always present unless marked optional; `null` is written out explicitly.

```
User         { id, email, display_name, role: "employee"|"manager", company: Company }
Company      { id, name }
UserRef      { id, display_name }
RequestListItem   { id, title, vendor, amount, currency: "USD", status: "pending"|"approved"|"rejected",
                    submitted_at, requester: UserRef }
RequestDetail     RequestListItem + { description, decided_by: UserRef|null, decided_at: string|null,
                    rejection_reason: string|null, can_decide: boolean, events: [Event] }
Event        { type: "submitted"|"approved"|"rejected", actor: UserRef, created_at, reason: string|null }
RequestList  { count, page, page_size: 20, page_count, results: [RequestListItem] }
RequestSummary { all, pending, approved, rejected }   (integers)
```

* `events` is derived from the request row (D-55) and ordered oldest first: first `{type:"submitted", actor: requester, created_at: submitted_at, reason: null}`, then, if decided, `{type:"approved"|"rejected", actor: decided_by, created_at: decided_at, reason: rejection_reason or null}`. Submission is always first, also when timestamps are equal.
* `decided_by`, `decided_at`, `rejection_reason` are all `null` while pending; `rejection_reason` is non-null only for rejected requests.
* `description` and `rejection_reason` use `\n` line breaks.
* Text values are returned exactly as stored (trimmed, newline-normalized). They are plain text; clients must never interpret them as markup.

## 5. Errors

Every error from a route under `/api/` (except `GET /api/health/`) has this body, and no other:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Check the highlighted fields.",
    "fields": { "title": [ { "code": "required", "message": "Enter a title." } ] },
    "request": { }
  }
}
```

* `code` and `message` are always present. `fields` is present only for `validation_error`; `request` (a `RequestDetail`) only for `already_decided`.
* The frontend branches on `code` and on field `code`, and shows its own text from `copy.ts`. `message` is a safe fallback only. It never contains stack traces, SQL, input values, or whether an inaccessible id exists.
* 5xx responses use `server_error`. Unhandled exceptions are logged server-side (code, path, exception class; never request bodies or passwords).

| HTTP | `code` | `message` (fixed text) | When |
|---|---|---|---|
| 400 | `validation_error` | Check the highlighted fields. | field rules, malformed JSON, wrong content type, bad query, bad idempotency key |
| 401 | `not_authenticated` | Sign in to continue. | no or expired session |
| 401 | `invalid_credentials` | Email or password is incorrect. | login failure |
| 403 | `csrf_failed` | Your session could not be verified. Reload the page and try again. | CSRF check |
| 403 | `not_permitted` | You do not have permission to decide requests. | Employee deciding own request |
| 403 | `own_request` | Another manager must review your request. | Manager deciding own request |
| 404 | `request_unavailable` | Request unavailable. It may not exist or you may not have access. | every inaccessible request id |
| 404 | `not_found` | Not found. | unknown `/api/` path |
| 405 | `method_not_allowed` | Method not allowed. | unsupported method |
| 409 | `already_decided` | This request has already been decided. | decision on a non-pending request; includes `request` |
| 409 | `idempotency_conflict` | This submission key was already used with different values. | same key, different payload |
| 429 | `throttled` | Request was throttled. | too many failed logins (section 3.1); carries `Retry-After` |
| 500 | `server_error` | Something went wrong. Try again. | anything else |

Other 4xx protocol errors raised by DRF and not listed above (for example 406 for an `Accept` header the API cannot satisfy) keep their own HTTP status. `code` is DRF's `default_code` (`not_acceptable`, …) and `message` is DRF's fixed `default_detail` text, never request-specific detail. These are not logged as server errors. Clients that do not know the code treat it as `server_error`.

Field error `code` values (D-56): `required`, `too_long`, `invalid_characters`, `invalid_format`, `too_many_decimals`, `out_of_range`, `invalid_choice`. Field names in `fields` are the request body names (`title`, `vendor`, `description`, `amount`, `reason`, `email`, `password`), the query names (`status`, `page`), the header-derived name `idempotency_key`, and `_body` for problems with the body as a whole (malformed JSON, body not an object, wrong content type). Each field lists the errors in check order; clients use the first.

## 6. Validation rules

Authoritative test data: `testdata/validation-cases.json` (246 cases). The backend validator and the frontend validator must both pass every case exactly (value normalization and first error code). Rules, from plan D-25 to D-30 and D-56:

**Trim set** (leading and trailing only): U+0009–000D, U+0020, U+0085, U+00A0, U+1680, U+2000–200A, U+2028, U+2029, U+202F, U+205F, U+3000. Do not use language built-ins (`str.strip`, `String.trim`): they differ on U+001C–001F, U+0085 and U+FEFF. U+FEFF and U+200B are not trimmed.

**Text fields** (`title`, `vendor`, `description`, `reason`), in this order:

1. Missing or `null` → `required`. Not a string → `invalid_format`.
2. Multiline fields only (`description`, `reason`): normalize `\r\n` and `\r` to `\n`.
3. Trim. Empty → `required`.
4. Any lone surrogate (U+D800–DFFF) → `invalid_characters`. Any Unicode category Cc character → `invalid_characters`, except `\n` in multiline fields. Single-line fields (`title`, `vendor`) additionally reject U+2028 and U+2029 anywhere inside.
5. Length in Unicode code points (not UTF-16 units, not bytes) above the limit → `too_long`. Limits: title 120, vendor 120, description 2,000, reason 1,000. The stored and returned value is the trimmed, normalized text.

**Amount**, in this order:

1. Missing, `null`, or empty/whitespace-only string → `required`. Not a JSON string (number, boolean, array, object) → `invalid_format`.
2. Trim ASCII whitespace only (U+0009–000D, U+0020).
3. Must match `^[0-9]+(\.[0-9]+)?$` (ASCII digits) → else `invalid_format`. This rejects `-5`, `+5`, `.5`, `25.`, `1e3`, `1,000`, `$5`, `25,50`, non-ASCII digits.
4. More than 2 digits after the period → `too_many_decimals` (also when the value is otherwise out of range).
5. More than 6 digits before the period (leading zeros count), or value below 0.01 or above 999,999.99 → `out_of_range`.
6. Result is a string with exactly two decimals (`25` → `"25.00"`, `025` → `"25.00"`). Computed with exact decimal arithmetic, never floating point.

**Login**: `email` — missing/null → `required`, non-string → `invalid_format`, trim, empty → `required`. `password` — same checks, but no trimming; any non-empty string is valid.

## 7. Behavior notes for implementers

* Neutral 404: use one lookup that includes the visibility filter, and one response builder for `request_unavailable`. A request that exists in another company must be indistinguishable from a random id.
* `GET` list counts (`count`, `page_count`) must be computed from the already-filtered queryset.
* Decisions: lock the row (`SELECT … FOR UPDATE`) after the visibility lookup, then re-check status. Write status, decider, time and reason in one statement inside one transaction.
* The activity history is never stored separately; do not add an events table (D-55).

## 8. What's new

* **T11 (New request screen):** no change to endpoints, shapes, error codes or validation rules. The frontend mock server (`frontend/src/mocks/handlers.ts`) now implements `POST /api/requests/` as specified in section 3.3: it requires `Idempotency-Key`, replays the same request (200) for the same user, key and payload, and answers `409 idempotency_conflict` when the key is reused with different values.
* **T12 (Request details and decision dialogs):** no change to endpoints, shapes, error codes or validation rules. The frontend mock server now implements `GET /api/requests/{id}/`, `POST /api/requests/{id}/approve/` and `POST /api/requests/{id}/reject/` with the check order of section 3.5 (404, `not_permitted`, `own_request`, `already_decided` with `request`, then `reason` validation).
* **Docs catch-up:** `GET /api/requests/summary/` has been implemented in the backend and used by the list screen since T05/T10 but was missing here and in `docs/openapi.yaml`. It is now documented (section 3.2a, shape `RequestSummary`, OpenAPI path). Behavior is unchanged.
* **Sign-in throttling (D-24):** `POST /api/auth/login/` can answer 429 `throttled` with `Retry-After` (section 3.1, table in section 5). The frontend knows the code and shows its own text from `copy.ts`.
* **Error fallback:** DRF 4xx exceptions without a row in the section 5 table no longer become `500 server_error`. They keep their own status, with `code` = DRF `default_code` and `message` = DRF `default_detail` (section 5). No change to the listed codes or to the frontend.
