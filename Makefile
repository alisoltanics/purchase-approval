# Every target runs in containers, so the host needs only Docker, Compose and make.
NODE_IMAGE := node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
FRONTEND_RUN := docker run --rm --user "$(shell id -u):$(shell id -g)" -e HOME=/tmp -v "$(CURDIR)/frontend:/app" -v "$(CURDIR)/testdata:/testdata:ro" -w /app $(NODE_IMAGE)

# Separate project name: tests can never touch the development database volume.
TEST_COMPOSE := docker compose -p purchase-approval-test -f compose.yaml -f compose.test.yaml
DEV_COMPOSE := docker compose -f compose.yaml -f compose.dev.yaml

.PHONY: help lint lint-backend lint-frontend typecheck test test-backend test-frontend e2e build dev-up dev-down

help:
	@echo "make lint        ruff, ESLint, tsc"
	@echo "make test        backend (pytest) and frontend (Vitest) tests"
	@echo "make e2e         Playwright suite against the test stack (suite added by T13)"
	@echo "make build       production image"
	@echo "make dev-up      start the dev database and app"
	@echo "make dev-down    stop dev containers (keeps the database volume)"

lint: lint-backend lint-frontend

lint-backend:
	$(TEST_COMPOSE) run --rm --build --no-deps app ruff check .
	$(TEST_COMPOSE) run --rm --build --no-deps app ruff format --check .

lint-frontend: typecheck
	$(FRONTEND_RUN) sh -c "npm ci --no-fund --no-audit && npm run lint"

typecheck:
	$(FRONTEND_RUN) sh -c "npm ci --no-fund --no-audit && npm run typecheck"

test: test-backend test-frontend

test-backend:
	$(TEST_COMPOSE) run --rm --build app pytest; status=$$?; $(TEST_COMPOSE) down; exit $$status

test-frontend:
	$(FRONTEND_RUN) sh -c "npm ci --no-fund --no-audit && npm test"

e2e:
	@if [ -z "$$(find e2e -name '*.spec.ts' 2>/dev/null)" ]; then \
		echo "No E2E specs yet (task T13)."; \
	else \
		$(TEST_COMPOSE) up -d --wait app && \
		$(TEST_COMPOSE) run --rm app python manage.py migrate --noinput && \
		$(TEST_COMPOSE) run --rm e2e; status=$$?; \
		$(TEST_COMPOSE) down; exit $$status; \
	fi

build:
	docker build -t purchase-approval-app:local .

dev-up:
	HOST_UID=$$(id -u) HOST_GID=$$(id -g) $(DEV_COMPOSE) up -d --build --wait

dev-down:
	$(DEV_COMPOSE) down
