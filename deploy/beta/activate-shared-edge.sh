#!/bin/sh
# Owner-operated first edge cutover after beta health and DNS verification.
set -eu
umask 077
cd /opt/sapienworx-beta
exec 9>/opt/sapienworx/runtime/deploy.lock
flock -n 9 || { echo 'Another edge/production deployment is running.' >&2; exit 1; }
test -f runtime/deployed-sha
test -f /opt/sapienworx/runtime/holding-release
echo 'd35c4a69f4858622a5e561b4a38414b22f74f2481a08a2990014a29fb80b8188  /opt/sapienworx/holding/releases/775f239/public/index.html' | sha256sum -c -
getent ahostsv4 beta.sapienworx.com | awk '{print $1}' | grep -qx 13.206.138.176
for container in sapienworx-beta-backend sapienworx-beta-frontend sapienworx-beta-intelligence; do
  test "$(docker inspect --format '{{.State.Health.Status}}' "$container")" = healthy
done
docker compose -f compose.edge.yml config --quiet
docker compose -f compose.edge.yml run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile
verified=no
recover() {
  if [ "$verified" = no ]; then
    docker compose -f /opt/sapienworx/holding/releases/775f239/compose.holding.yml up -d --force-recreate caddy
  fi
}
trap recover EXIT
docker compose -f compose.edge.yml up -d --force-recreate caddy
ready=no
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --resolve beta.sapienworx.com:443:127.0.0.1 https://beta.sapienworx.com/health/ready >/dev/null; then ready=yes; break; fi
  sleep 2
done
test "$ready" = yes
for host in sapienworx.com www.sapienworx.com; do
  curl --fail --silent --show-error --resolve "$host:443:127.0.0.1" "https://$host/" -o runtime/holding-verify.html
  echo 'd35c4a69f4858622a5e561b4a38414b22f74f2481a08a2990014a29fb80b8188  runtime/holding-verify.html' | sha256sum -c -
  test "$(curl --silent --show-error --resolve "$host:443:127.0.0.1" -o /dev/null -w '%{http_code}' "https://$host/api/v1/auth/login")" = 404
done
verified=yes
echo 'Shared edge verified: public page unchanged, public API blocked, beta ready.'
