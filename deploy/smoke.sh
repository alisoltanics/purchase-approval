#!/usr/bin/env bash
# Staging smoke test (AC-32). Reads SMOKE_* from the environment or .env.staging; no defaults for secrets.
source "$(dirname "$0")/lib.sh"
for v in SMOKE_BASE_URL SMOKE_EMPLOYEE_EMAIL SMOKE_MANAGER_EMAIL SMOKE_PASSWORD SMOKE_OTHER_COMPANY_MANAGER_EMAIL; do
  if [ -z "${!v:-}" ]; then export "$v=$(env_value "$v")"; fi
done
: "${SMOKE_BASE_URL:?set SMOKE_BASE_URL}"
for _ in $(seq 1 20); do
  curl -fsS "${SMOKE_BASE_URL%/}/api/health/" | grep -q '"ok"' && break
  sleep 3
done
curl -fsS "${SMOKE_BASE_URL%/}/api/health/" | grep -q '"ok"' || { echo "health check failed" >&2; exit 1; }
curl -fsS "${SMOKE_BASE_URL%/}/" | grep -qi "<div id=\"root\"" || { echo "SPA index not served" >&2; exit 1; }
exec python3 -I deploy/smoke.py
