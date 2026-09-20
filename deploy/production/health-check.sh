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

healthy() {
  service="$1"
  container_id="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q "$service")"
  [ -n "$container_id" ] || { echo "$service is not running" >&2; return 1; }
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
  [ "$status" = "healthy" ] || { echo "$service health is $status" >&2; return 1; }
}

healthy backend
healthy frontend

if [ "${CADDY_ENABLED:-false}" = "true" ]; then
  healthy caddy
  wget -qO- --timeout=10 "https://sapienworx.com/health/ready" >/dev/null
fi

echo "SapienWorx production health checks passed."
