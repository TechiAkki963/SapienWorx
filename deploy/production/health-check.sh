#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
COMPOSE_FILE="${ROOT_DIR}/compose.production.yml"
ENV_FILE="${ROOT_DIR}/runtime/production.env"
CONF_FILE="${ROOT_DIR}/runtime/deployment.conf"

[ -f "$ENV_FILE" ] || { echo "Runtime environment is missing." >&2; exit 1; }

set -a
. "$ENV_FILE"
[ ! -f "$CONF_FILE" ] || . "$CONF_FILE"
set +a

wait_until_healthy() {
  service="$1"
  attempt=1
  while [ "$attempt" -le 24 ]; do
    container_id="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q "$service")"
    if [ -n "$container_id" ]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
      [ "$status" = "healthy" ] && return 0
    else
      status="not running"
    fi
    sleep 5
    attempt=$((attempt + 1))
  done

  echo "$service did not become healthy within 120 seconds (last status: $status)" >&2
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps "$service" >&2 || true
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --no-color --tail=100 "$service" >&2 || true
  return 1
}

wait_until_healthy backend
wait_until_healthy frontend

if [ "${CADDY_ENABLED:-false}" = "true" ]; then
  wait_until_healthy caddy
  wget -qO- --timeout=10 "https://sapienworx.com/health/ready" >/dev/null
fi

echo "SapienWorx production health checks passed."
