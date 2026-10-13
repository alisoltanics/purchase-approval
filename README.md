# Purchase Approval

Django + DRF + PostgreSQL backend, React + TypeScript + Vite frontend, shipped as one image.

* Spec and decisions: `docs/PRD.md`, `docs/implementation-plan.md`, `docs/api-contract.md`, `docs/seed-spec.md`.
* Config: copy `.env.example` to `.env` (dev) or `.env.staging` (staging) and fill in the values. Names only are committed.
* Checks: `make lint`, `make typecheck`, `make test`, `make e2e` (Docker required; E2E needs `E2E_DEMO_PASSWORD` = `SEED_DEMO_PASSWORD`, see `e2e/README.md`).
* Migrate and seed: `docker compose run --rm app python manage.py migrate` then `... seed_demo` (idempotent).
* Deploy, smoke test and rollback: `deploy/README.md`.
