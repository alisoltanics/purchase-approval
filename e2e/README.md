# End-to-end tests (Playwright, Chromium)

Written from `docs/PRD.md`, `docs/api-contract.md`, `docs/seed-spec.md` and `frontend/src/copy.ts` only (task T13). No implementation code was read.

## Run

```
export E2E_DEMO_PASSWORD=<the SEED_DEMO_PASSWORD used to seed the stack>
make e2e
```

`make e2e` starts the test stack, migrates and runs the `e2e` service of `compose.test.yaml` (`E2E_BASE_URL=http://web.test:8000`). The stack must be seeded with `seed_demo` and `seed_test_fixtures` (data exactly as in `docs/seed-spec.md`). The password is read from `E2E_DEMO_PASSWORD`; the suite fails with a clear message if it is unset. Nothing is hardcoded.

## Non-destructive design

No reset mechanism exists in the contract, so specs never reset data:

* Specs that change data create their own requests (unique title with a random suffix, `support/helpers.ts`) and only decide requests they created.
* Seed requests and fixture data are only read.
* Order-insensitive: every spec logs in itself, 1 worker, no shared state between tests. Created requests accumulate (Northstar's list grows); assertions on seed data are therefore written to be independent of extra requests (they look up seed titles, never count Northstar totals).
* Fixture Co (Ola, Noa, Eli, Mia) is never written to, so its counts (45 / 25 / 3 / 0) stay exact.

## Layout

* `support/copy.ts` - duplicate of `frontend/src/copy.ts` (no frontend imports). Re-copy if the frozen copy changes.
* `support/accounts.ts`, `support/fixtures.ts`, `support/uuid5.ts` - seed data, 45 fixture requests and their ids.
* `support/helpers.ts` - login, create-request via UI, unique titles, locators. `support/axe.ts` - axe scan.
* `tests/*.spec.ts`: `auth` (AC-01..04, 30), `list` (AC-05..08, 22, 28), `submit` (AC-09..13, 29), `details` (AC-14, 20..23, 27), `decisions` (AC-15..19, 21, 25, 26, 29, 30), `a11y` (axe + keyboard, AC-31), `narrow` (390 px, AC-31).

## Assumptions about the UI (not fixed by the PRD)

Locators use roles, labels and the exact copy strings. The PRD leaves these open and the tests accept both: list as table rows or list items/cards; New request and Cancel as link or button; Previous/Next as button or link. The tests assume: the page-size/URL query `?status=&page=` (plan D-14) and `/requests/new`, `/requests/:id`, `/login?next=` routes (plan 7.1, D-33); the state text of the details page is plain text elements matching copy (`Submitted by {actor}`, etc.); amounts are shown as `USD 25.50`; an element with exactly the user's name is visible in the shell.
