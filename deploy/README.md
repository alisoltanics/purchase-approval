# Deployment, release and rollback

Image registry and host are team-provided (D-49). Everything is parameterised by `IMAGE_REPO` and `IMAGE_TAG`; TLS and the public hostname come from the host or a proxy in front (D-50). The app serves plain HTTP on `APP_PORT`.

## One-time host setup
1. Install Docker Engine with Compose v2. Clone the repo (or copy `compose.yaml`, `compose.staging.yaml`, `deploy/`).
2. `cp .env.example .env.staging && chmod 600 .env.staging`, then fill in the values. Generate `DJANGO_SECRET_KEY` and `POSTGRES_PASSWORD` randomly (e.g. `openssl rand -base64 48`). Set `DJANGO_ENV=staging`, `POSTGRES_HOST=db`, `POSTGRES_PORT=5432`, `COOKIE_SECURE=true` if served over HTTPS, `ALLOWED_HOSTS` (must include `127.0.0.1` for the container health check plus the public host name), `CSRF_TRUSTED_ORIGINS` (full origin, e.g. `https://staging.example`). Leave `ALLOW_SEED_RESET` empty.
3. `SEED_DEMO_PASSWORD` is the demo password; hand it to the team lead through the agreed channel (D-46). `SMOKE_*` use the same password. Never commit `.env.staging`.
4. Create the database volume once: `docker volume create purchase-approval-staging-pgdata`.

## Release (D-51, D-52)
On the dev/CI machine: run `make lint typecheck test e2e`, then
```
TAG=$(git rev-parse --short HEAD)
docker build -t $IMAGE_REPO:$TAG -t $IMAGE_REPO:staging . && docker push $IMAGE_REPO:$TAG && docker push $IMAGE_REPO:staging
```
On the staging host:
```
IMAGE_TAG=<sha> deploy/release.sh          # first release: add --seed
```
`release.sh` records the running tag in `deploy/.previous-tag`, runs `deploy/backup.sh` (pg_dump to `deploy/backups/`), pulls the image, runs `migrate` as a separate step (the app never migrates), optionally the idempotent `seed_demo`, starts the app, waits for healthy and runs `deploy/smoke.sh`. It never runs `down -v` or removes volumes, so data persists across redeploys.

## Smoke test (AC-32)
`deploy/smoke.sh` needs `SMOKE_BASE_URL`, `SMOKE_EMPLOYEE_EMAIL`, `SMOKE_MANAGER_EMAIL`, `SMOKE_PASSWORD` (from the environment or `.env.staging`) and optionally `SMOKE_OTHER_COMPANY_MANAGER_EMAIL` (manager of another company, for the isolation check). It checks health and the SPA, then: employee submits two requests, an employee cannot approve, a manager approves one and rejects the other with a reason, statuses persist, the other company's manager gets 404. Request ids are kept in `deploy/.smoke-ids`; the next run first checks they still exist, which proves persistence across a redeploy. Smoke data (titles "Smoke approve/reject") stays on staging; it is fictional.

## Rollback
```
deploy/rollback.sh                                   # previous image, same database
deploy/rollback.sh --restore deploy/backups/<file>   # also restore the pre-release dump
```
Migrations are forward-only: use `--restore` only if the failed release applied a schema migration. It replaces the database content and asks for confirmation. Smoke runs afterwards.

## Seeding and reset
`seed_demo` is idempotent and never modifies existing data. `--reset` needs `ALLOW_SEED_RESET=true` and `--yes-i-am-sure`; do that only after agreeing with the team (D-45). `seed_test_fixtures` is refused on staging.
