#!/usr/bin/env bash
# Usage: IMAGE_TAG=<git short sha> deploy/release.sh [--seed]
# Run on the staging host after the image was pushed (docs/implementation-plan.md 10.5).
# Never runs `down -v` or removes volumes. --seed runs the idempotent seed_demo (first release only).
source "$(dirname "$0")/lib.sh"

SEED=false
[ "${1:-}" = "--seed" ] && SEED=true

: "${IMAGE_TAG:?set IMAGE_TAG to the git short SHA being released}"
export IMAGE_REPO="${IMAGE_REPO:-$(env_value IMAGE_REPO)}"
: "${IMAGE_REPO:?set IMAGE_REPO (env or $ENV_FILE)}"

# 1. Remember what is running now, so rollback.sh can return to it.
cid="$(dc ps -q app 2>/dev/null || true)"
if [ -n "$cid" ]; then
  current="$(docker inspect -f '{{.Config.Image}}' "$cid")"
  echo "${current##*:}" > deploy/.previous-tag
  echo "Previous tag recorded: ${current##*:}"
  # 2. Back up before touching anything (D-51: migrations are forward-only).
  deploy/backup.sh
else
  echo "No running app: first release, nothing to record or back up."
fi

# 3. Pull, migrate (controlled step, the app never migrates itself), start.
dc pull app
dc up -d --wait db
dc run --rm app python manage.py migrate --noinput
if $SEED; then
  dc run --rm app python manage.py seed_demo
fi
dc up -d
wait_healthy

# 4. Smoke test (AC-32). A failing smoke test fails the release; run rollback.sh.
deploy/smoke.sh
echo "Release $IMAGE_TAG OK."
