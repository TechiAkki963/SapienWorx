#!/bin/sh
# Owner-operated only after separate transition/activation approval.
set -eu
umask 077
cd /opt/sapienworx-beta
exec 9>/opt/sapienworx/runtime/deploy.lock
flock -n 9 || { echo 'Another edge/production deployment is running.' >&2; exit 1; }
mode=${1:-reload}
case "$mode" in reload|--bootstrap-admin) ;; *) echo 'Use reload or --bootstrap-admin.' >&2; exit 2 ;; esac
test -f /opt/sapienworx/runtime/holding-release
./verify-public-edge.sh
docker network inspect sapienworx_beta_proxy >/dev/null
install -d -m 0750 edge
if [ "$mode" = --bootstrap-admin ]; then
  test "${CONFIRM_INITIAL_EDGE_TRANSITION:-}" = APPROVED_ONE_TIME_RESTART
  test ! -f edge/managed
  docker exec sapienworx-caddy caddy version | grep -q '^v2.10.2 '
  docker exec sapienworx-caddy cat /etc/caddy/Caddyfile | cmp - /opt/sapienworx/holding/releases/775f239/Caddyfile
  docker compose -f compose.edge.yml config --quiet
  cp Caddyfile.holding-admin edge/Caddyfile
  docker compose -f compose.edge.yml run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile
  ok=no
  recover_initial() {
    if [ "$ok" = no ]; then
      docker compose -f /opt/sapienworx/holding/releases/775f239/compose.holding.yml up -d --no-deps --pull never --force-recreate caddy
    fi
  }
  trap recover_initial EXIT
  # Only planned recreation; needs explicit one-time restart approval.
  docker compose -f compose.edge.yml up -d --no-deps --pull never --force-recreate caddy
  ready=no
  for attempt in $(seq 1 15); do
    if docker exec sapienworx-caddy wget -qO- http://127.0.0.1:2020/config/ >/dev/null 2>&1 && ./verify-public-edge.sh; then ready=yes; break; fi
    sleep 1
  done
  test "$ready" = yes
  touch edge/managed
  ok=yes
  echo 'Holding-only admin bootstrap verified. Beta has not been activated.'
  exit 0
fi
test -f edge/managed || { echo 'Approved one-time admin bootstrap is required first.' >&2; exit 1; }
test -f runtime/deployed-sha
getent ahostsv4 beta.sapienworx.com | awk '{print $1}' | grep -qx 13.206.138.176
for container in sapienworx-beta-backend sapienworx-beta-frontend sapienworx-beta-intelligence; do
  test "$(docker inspect --format '{{.State.Health.Status}}' "$container")" = healthy
done
cp Caddyfile.shared edge/candidate
docker exec sapienworx-caddy caddy validate --config /etc/caddy/candidate --adapter caddyfile
cp edge/Caddyfile edge/previous
verified=no
recover() {
  if [ "$verified" = no ]; then
    cp edge/previous edge/restore.tmp
    mv edge/restore.tmp edge/Caddyfile
    docker exec sapienworx-caddy caddy reload --address 127.0.0.1:2020 --config /etc/caddy/Caddyfile --adapter caddyfile
    ./verify-public-edge.sh
  fi
}
trap recover EXIT
mv edge/candidate edge/Caddyfile
docker exec sapienworx-caddy caddy reload --address 127.0.0.1:2020 --config /etc/caddy/Caddyfile --adapter caddyfile
./verify-public-edge.sh
ready=no
for attempt in $(seq 1 60); do
  if curl --fail --silent --show-error --max-time 5 --resolve beta.sapienworx.com:443:127.0.0.1 https://beta.sapienworx.com/health/ready >/dev/null; then ready=yes; break; fi
  sleep 2
done
test "$ready" = yes
./verify-public-edge.sh
verified=yes
echo 'Shared edge verified through supported graceful reload; public holding page unchanged.'
