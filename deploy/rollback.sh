#!/usr/bin/env bash
# Usage: deploy/rollback.sh [--restore <backup.sql.gz>]
# Redeploys the tag in deploy/.previous-tag. If the failed release applied a schema migration,
# pass --restore with the pre-release dump (printed by release.sh): it REPLACES the database content.
source "$(dirname "$0")/lib.sh"

[ -f deploy/.previous-tag ] || { echo "deploy/.previous-tag not found; nothing to roll back to." >&2; exit 1; }
export IMAGE_TAG="$(cat deploy/.previous-tag)"
export IMAGE_REPO="${IMAGE_REPO:-$(env_value IMAGE_REPO)}"
echo "Rolling back to tag $IMAGE_TAG"

if [ "${1:-}" = "--restore" ]; then
  dump="${2:?usage: rollback.sh --restore <backup.sql.gz>}"
  [ -f "$dump" ] || { echo "no such dump: $dump" >&2; exit 1; }
  read -r -p "This replaces the staging database with $dump. Type 'restore' to continue: " answer
  [ "$answer" = restore ] || { echo "aborted"; exit 1; }
  dc stop app
  dc up -d --wait db
  dc exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
  gunzip -c "$dump" | dc exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q'
fi

dc pull app
dc up -d
wait_healthy
deploy/smoke.sh
echo "Rollback to $IMAGE_TAG OK."
