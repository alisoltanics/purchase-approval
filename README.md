# Purchase Approval

A small multi-company app where employees submit purchase requests and managers approve or reject them. Django + DRF + PostgreSQL backend, React + TypeScript + Vite frontend, shipped as one Docker image (the SPA is built into it); development adds a separate Vite container.

Verification evidence, known limitations and the demo script: **[docs/verification-report.md](docs/verification-report.md)**.

## 1. Introduction and architecture

* **Employees** submit requests and follow their status. **Managers** see all requests of their company and approve or reject them (rejection needs a reason). A manager cannot decide their own request, and a request can be decided exactly once.
* **Companies are isolated**: users never see another company's data. Unknown, malformed and foreign ids all give the same neutral 404.
* **Safe retries**: every submit carries an `Idempotency-Key`; two simultaneous decisions are serialised by a row lock, so one wins and the other gets `409 already_decided`.
* Money is a `Decimal` in Python and a string in the API and UI (never a float). Currency is USD, times are UTC.

The app runs in two shapes:

**Staging / production: one app container.** The React SPA is built into the image and served by Django, so the browser talks to a single origin.

**Development (`compose.dev.yaml`): three containers.** A separate `frontend` container runs the Vite dev server with hot reload. The browser only talks to Vite (port 5173), which proxies `/api` to the `app` container, so there is still one origin (no CORS) and the session cookie stays same-origin. Django runs `runserver` instead of Gunicorn and does not serve the SPA here.

Tests use a fourth, one-off `e2e` container (Playwright) against the test stack; see section 3.

## 2. Running the project

Requires Docker with Compose v2. Nothing else is installed on the host.

```sh
export SEED_DEMO_PASSWORD='choose-a-password-12+chars'      # the demo password for every account
docker compose -f compose.yaml -f compose.dev.yaml up -d --build --wait db app
docker compose -f compose.yaml -f compose.dev.yaml run --rm app python manage.py migrate
docker compose -f compose.yaml -f compose.dev.yaml run --rm app python manage.py seed_demo   # idempotent
docker compose -f compose.yaml -f compose.dev.yaml up -d frontend    # Vite dev server with hot reload
```

Code in `backend/` and `frontend/` is bind-mounted, so edits reload automatically. The first start of `frontend` runs `npm ci`, so give it a minute (`docker compose ... logs -f frontend`). The browser only talks to port 5173; Vite proxies `/api` to the app, so there is no CORS and the session cookie stays same-origin.

| What | Address |
|---|---|
| App (open this) | http://localhost:5173 |
| API (Django `runserver`) | http://localhost:8000/api/ (health: `/api/health/`) |
| PostgreSQL | 127.0.0.1:5432, db/user `purchase_approval`, password `dev-only-password` (dev only) |

**Sign in** with any account below and the `SEED_DEMO_PASSWORD` you exported:

| Email | Role | Company |
|---|---|---|
| `alex@northstar.example` | employee | Northstar Labs |
| `sam@northstar.example` | employee | Northstar Labs |
| `jordan@northstar.example` | manager | Northstar Labs |
| `taylor@northstar.example` | manager | Northstar Labs |
| `casey@harbor.example` | employee | Harbor Works |
| `riley@harbor.example` | manager | Harbor Works |

`seed_demo` never modifies existing data, including passwords. If the database was already seeded with a different password (sign-in says "Email or password is incorrect."), reseed it. **This deletes all data in the dev database:**

```sh
docker compose -f compose.yaml -f compose.dev.yaml run --rm -e ALLOW_SEED_RESET=true app \
  python manage.py seed_demo --reset --yes-i-am-sure
```

`--reset` always needs `ALLOW_SEED_RESET=true` and `--yes-i-am-sure` (never set on staging). `seed_test_fixtures` (extra Fixture Co data for tests) is refused outside `dev`/`test`. Seed details: `docs/seed-spec.md`.

Production-like image: `make build` (or `docker build -t purchase-approval-app:local .`) serves the SPA from Django on port 8000. Staging deployment: [deploy/README.md](deploy/README.md).

## 3. Tests

Everything runs in containers; the host needs only Docker, Compose and `make`.

| Suite | What it covers | Command | Count |
|---|---|---|---|
| Lint and types | ruff (lint + format check), ESLint, `tsc` | `make lint` | – |
| Backend | pytest: unit, model constraints, API (auth, list, submit, detail, decisions, isolation, protocol), seeding, real-thread concurrency on Postgres | `make test-backend` | 685 |
| Frontend | Vitest + Testing Library + MSW (mock server built from the API contract) | `make test-frontend` | 447 |
| End to end | Playwright (Chromium) against the full stack: journeys, a11y with axe, keyboard, 390 px width | `E2E_DEMO_PASSWORD=<seed password> SEED_DEMO_PASSWORD=<same> make e2e` * | 131 |
| Staging smoke | stdlib script: submit, approve, reject, isolation, persistence | `deploy/smoke.sh` | – |

\* `make e2e` starts the test stack (DB on tmpfs), migrates, and runs the suite; the stack must be seeded with `seed_demo` and `seed_test_fixtures` first (see `e2e/README.md`).

**Coverage** (measured 2026-10-13, tools not committed as dependencies):

| Part | Statements | Branches | Lines |
|---|---|---|---|
| Backend (pytest-cov) | 99% (904 stmts, 10 missed) | – | – |
| Frontend (vitest v8) | 93.0% | 89.4% | 94.8% |

Acceptance criteria (AC-01 to AC-32) map to tests in the verification report.

## 4. Where is the code?

```
backend/
  config/       Django settings (env driven), root urls, wsgi
  accounts/     Company, User, session login/logout/me
  approvals/    PurchaseRequest model, selectors (visibility), rules, services (submit, decide), views
  common/       error format, exception handler, middleware (no-store), pagination, validators
  seeding/      seed_demo and seed_test_fixtures management commands
  tests/        api, models, unit, seeding, common
frontend/src/
  api/          API client, TanStack Query hooks, error mapping
  routes/       pages: sign-in, requests list, new request dialog, request details + decision dialogs
  components/   shell, modal, toast, form fields, status badge
  validation/   shared validators (same cases as the backend: testdata/validation-cases.json)
  mocks/        MSW handlers used by unit tests
  copy.ts       all UI texts
e2e/            Playwright specs and helpers
deploy/         release, backup, rollback, smoke scripts
docs/           PRD, implementation plan, API contract, OpenAPI, seed spec, verification report
testdata/       validation cases shared by backend and frontend tests
compose*.yaml   base, dev, test and staging Compose files
```

## 5. Database models

PostgreSQL 16. Three tables; ids are UUID v4 (a request's id is its public reference).

* `Company` (id, name) has many `User`s and many `PurchaseRequest`s.
* `User` (id, email, display_name, company, role `employee|manager`, is_active).
* `PurchaseRequest` (id, company, requester, title, vendor, description, amount 0.01 to 999999.99, currency USD, status `pending|approved|rejected`, submitted_at, decided_by, decided_at, rejection_reason, idempotency_key). `requester` and `decided_by` are users of the same company.

Integrity is enforced by the database, not only by code: CHECK constraints for amount range, USD only, status values, text lengths (title/vendor 1–120, description 1–2000, reason 1–1000), lowercase email, decision fields matching status, and decider ≠ requester; composite foreign keys keep requester and decider inside the request's company; `UNIQUE (requester, idempotency_key)` makes retries safe; indexes serve the company/status list and the employee list.

The activity timeline ("Submitted", "Approved/Rejected") is **derived** from the request row; there is no events table.

## 6. Important configuration

Variable names are in `.env.example` (values are never committed; real files `.env` and `.env.staging` are git-ignored).

| Variable | Meaning |
|---|---|
| `DJANGO_ENV` | `dev`, `test` or `staging` (required; `DEBUG` is on only in `dev`) |
| `DJANGO_SECRET_KEY` | required; generate randomly per environment |
| `ALLOWED_HOSTS` | comma list; must include `127.0.0.1` (container health check) |
| `CSRF_TRUSTED_ORIGINS` | comma list of full origins, e.g. `https://staging.example` |
| `COOKIE_SECURE` | `true` when served over HTTPS |
| `SESSION_IDLE_SECONDS` | sliding idle session timeout (default 3600) |
| `TRUSTED_PROXY_COUNT` | proxies in front of the app that append to `X-Forwarded-For` (default 0 = use `REMOTE_ADDR`). Set to `1` when one TLS proxy sits in front, otherwise sign-in throttling counts every client as the proxy's IP |
| `POSTGRES_HOST/PORT/DB/USER/PASSWORD` | database connection |
| `SEED_DEMO_PASSWORD` | demo password for seeded accounts (12+ chars, env only) |
| `ALLOW_SEED_RESET` | leave empty on staging |
| `APP_PORT`, `IMAGE_REPO`, `IMAGE_TAG` | staging port and image |
| `SMOKE_*`, `E2E_DEMO_PASSWORD` | smoke and E2E credentials |

## 7. Good to know

* **Source of truth**: `docs/PRD.md`; decisions D-01… are in `docs/implementation-plan.md`; the HTTP contract is `docs/api-contract.md` (+ `docs/openapi.yaml`). UI texts live only in `frontend/src/copy.ts` (the E2E suite keeps a copy in `e2e/support/copy.ts`; re-copy after changes).
* **Migrations are a separate step**; the app never migrates on start. They are forward-only, so rollback = previous image tag, plus the pre-release dump if a schema migration was applied.
* **Release scripts never remove volumes**; data survives redeploys. Staging reset is a coordinated manual action.
* **Chromium and `.app` hosts**: the E2E stack uses the host name `web.test` because browsers force HTTPS for `.app`.
* **Limitations** (not verified on a real staging host, Chromium only, no browser-Back discard prompt, etc.) are listed in the verification report.
* Never use real data or real passwords; all data is fictional.
