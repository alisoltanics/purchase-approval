# Sourced by the release scripts. Run them from anywhere; they work in the repo root.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.staging}"
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE (copy .env.example and fill it in)." >&2; exit 1; }

# --env-file feeds ${IMAGE_REPO}, ${IMAGE_TAG} and ${APP_PORT} interpolation in compose.staging.yaml.
dc() {
  docker compose --env-file "$ENV_FILE" -f compose.yaml -f compose.staging.yaml "$@"
}

env_value() {
  grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true
}

wait_healthy() {
  local cid status
  for _ in $(seq 1 60); do
    cid="$(dc ps -q app)"
    status="$([ -n "$cid" ] && docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo none)"
    [ "$status" = healthy ] && return 0
    sleep 3
  done
  echo "app did not become healthy (last status: $status)" >&2
  return 1
}
