# Verification report, limitations and demo checklist (T16)

Run date: 2026-10-13, commit after `c6195bb` (T15). Stack: test Compose project (`compose.test.yaml`, Postgres 16 on tmpfs, image built from the release `Dockerfile`).

## 1. Results

| Check | Command | Result |
|---|---|---|
| Lint (ruff, ESLint, tsc) | `make lint` | pass |
| Backend unit and API tests | `make test-backend` | 685 passed |
| Frontend unit and component tests | `make test-frontend` | 447 passed (10 files) |
| E2E (Playwright, Chromium, axe, 390 px) | `make e2e` equivalent on a freshly migrated and seeded DB | 131 passed, retries off |
| Staging smoke journey (`deploy/smoke.py`) | run against the test stack | pass (not yet run on a real staging host, see 3) |

One E2E test (Escape on the discard dialog) was flaky in an earlier run. Cause: the form dialog's Escape handler could run before the discard dialog's. Fixed in `NewRequestDialog.tsx` (`requestClose` now only dismisses the discard question while it is open); afterwards the full suite passed with retries off and the three discard tests passed 8 repetitions each.

## 2. AC evidence

Plan mapping: `docs/implementation-plan.md` section 9.2. Tests name their AC id.

| AC | Backend | Frontend | E2E |
|---|---|---|---|
| AC-01 to AC-04 sign-in, errors, deep link, sign-out | `api/test_auth.py` | sign-in and routing tests | `auth.spec.ts` |
| AC-05 to AC-08 list, visibility, filter, pagination, return state | `api/test_list.py`, `test_summary.py` | list tests | `list.spec.ts` |
| AC-09 to AC-13 submit, validation, idempotency, discard | `api/test_submit.py`, shared `validation-cases.json` | `NewRequestDialog.test.tsx` | `submit.spec.ts` |
| AC-14 details | `api/test_detail.py` | `RequestDetailsPage.test.tsx` | `details.spec.ts` |
| AC-15 to AC-21 decisions, permissions, own request | `api/test_decisions.py` | `RequestDetailsPage.test.tsx` | `decisions.spec.ts` |
| AC-22 to AC-24 isolation, neutral 404, forged fields | `api/test_isolation.py`, `test_detail.py`, `test_submit.py` | - | `details.spec.ts`, `list.spec.ts` |
| AC-25, AC-26 conflicts, concurrent decisions | `api/test_decisions.py` (real threads, Postgres) | already-decided state | `decisions.spec.ts` (two browser contexts) |
| AC-27 no edit or delete | `api/test_protocol.py` (405) | - | `details.spec.ts` |
| AC-28, AC-29 states and failures | `api/test_submit.py`, `test_decisions.py` | MSW state tests | `list.spec.ts`, `submit.spec.ts` |
| AC-30 expired session | `api/test_auth.py` | `routing.test.tsx` | `auth.spec.ts` |
| AC-31 keyboard, axe, 390 px | - | - | `a11y.spec.ts`, `narrow.spec.ts` |
| AC-32 deployed journey | - | - | `deploy/smoke.py` (see 3) |

## 3. Limitations and open items (nothing hidden)

1. **AC-32 is not verified on a real staging host.** No staging URL, registry or host was available in this environment. `deploy/release.sh`, `backup.sh` and `rollback.sh` were syntax-checked and the compose overlay was validated with `docker compose config`, but never executed end to end. Persistence across a redeploy is only proven once `smoke.sh` runs twice on staging (the second run re-reads the first run's request ids). First action on staging: run the release, then run `deploy/smoke.sh` again after a redeploy.
2. **Design match was checked by automated tests and my own review of the markup, not by a human side-by-side comparison** with `docs/purchase-approval.html`. The plan (D-43) calls for a manual visual check including non-happy-path states; that remains for the demo review.
3. **Browser coverage is Chromium only.** axe covers WCAG 2.x A/AA rules it can detect automatically; a screen-reader pass was not done.
4. **Discard confirmation covers** the Cancel and close buttons, Escape, and clicks on in-app links. It does not intercept the browser Back button, address-bar navigation or tab close (no `beforeunload` prompt).
5. **Plain HTTP.** TLS comes from the staging host (D-50). Set `COOKIE_SECURE=true` when served over HTTPS.
6. **Smoke data stays on staging** (requests titled "Smoke approve/reject"); it is fictional.
7. **Frozen files edited with the owner's permission:** `frontend/src/copy.ts` (design-only keys added, T01 wording restored where specs depend on it, per the owner's option 3), and `docs/api-contract.md` / `docs/openapi.yaml` (summary endpoint and what's-new entries, T11 and T12).
8. **E2E spec edits in T14, approved by the owner** ("fix them, do anything"): Tab order in the keyboard test (vendor, amount, description), "Taylor Chen" absence scoped to the main content, discard dialog located by its name (the form is itself a dialog), the nav-link guard test uses `dispatchEvent` because the open modal hides the nav from the accessibility tree (this bypasses Playwright's actionability checks, so it checks the guard logic, not that a user can reach the link), and Alex's/Jordan's seed titles searched across list pages. No assertion was deleted or skipped.
9. No known defect that breaks a workflow, changes amounts or decisions, or exposes another user's data.

## 4. Architecture and agent notes

* **Structure:** Django apps `accounts` (users, companies, session auth), `approvals` (requests, decisions, idempotency), `common` (error format, middleware, pagination); React SPA built into the same image and served by Django (`static_spa`). Details: `docs/implementation-plan.md` sections 4 to 8.
* **Isolation:** every query goes through selectors that filter by company, then role; unknown, malformed and foreign ids give the same 404 (D-10).
* **Consistency:** submit uses a per-requester unique `Idempotency-Key` (replay returns the stored request, different payload gives 409). Decisions lock the row (`select_for_update`) inside a transaction, so of two simultaneous decisions one gets 200 and the other 409 `already_decided`.
* **Tasks:** T00 to T16 as in the plan. Shared interfaces (contract, OpenAPI, copy, validation cases, seed spec) were frozen at T01 and changed afterwards only as listed in 3.7.

## 5. Demo checklist (on staging, with the agreed demo password)

1. Sign in as `alex@northstar.example` (employee): company, name and role shown; list shows own requests only.
2. New request: submit with empty fields to show errors, then a valid one. Cancel after typing shows the discard dialog; Keep editing preserves values.
3. Open the new request: status Pending, one "Submitted" event, amount shows `USD`, times show `UTC`.
4. Sign out; sign in as `jordan@northstar.example` (manager): sees all Northstar requests with requester names.
5. Open Alex's request: Approve, confirm dialog, status Approved with actor and time. Open another pending one: Reject needs a reason (empty and 1001 characters are refused); cancelling discards the text.
6. Permission boundary: Jordan's own request shows the own-request notice and no decision buttons; Alex cannot decide anything.
7. Conflict: open the same pending request as Jordan and `taylor@northstar.example` in two browsers; decide as Jordan, then as Taylor: Taylor sees the already-decided message and Jordan's decision.
8. Company isolation: sign in as `riley@harbor.example`; Northstar requests are absent and a direct link gives the neutral unavailable state.
9. Persistence: refresh, then redeploy with the same volume (`deploy/release.sh`); data is still there; `deploy/smoke.sh` passes.
10. Keyboard and narrow width: complete the submit flow with Tab and Enter only; resize to 390 px, no horizontal scrolling.
