#!/bin/sh
set -eu
umask 077
cd /opt/sapienworx
exec 9>runtime/deploy.lock
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
release=/opt/sapienworx/holding/releases/775f239
previous=sapienworx-caddy-pre-holding-775f239
if docker inspect "$previous" >/dev/null 2>&1; then
  echo 'A prior holding cutover exists; inspect it before retrying.' >&2
  exit 1
fi
mkdir -p "$release" runtime/holding-backup-775f239
: "${HOLDING_BUNDLE_URL:?Supply a temporary read URL for the reviewed holding bundle}"
curl --fail --silent --show-error "$HOLDING_BUNDLE_URL" -o "$release/bundle.tar.gz"
echo "6721ec5fec3d87d66878ec6eaa1f4318889ad17134ee791d977baf7d4fff2be1  $release/bundle.tar.gz" | sha256sum -c -
tar -xzf "$release/bundle.tar.gz" -C "$release"
cp Caddyfile runtime/holding-backup-775f239/Caddyfile
cp runtime/deployed-sha runtime/holding-backup-775f239/application-sha
docker inspect sapienworx-caddy >runtime/holding-backup-775f239/caddy-container.json
docker compose -f "$release/compose.holding.yml" config --quiet
docker compose -f "$release/compose.holding.yml" run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile
stopped=no
renamed=no
verified=no
recover() {
  if [ "$verified" = no ]; then
    if [ "$renamed" = yes ]; then
      docker compose -f "$release/compose.holding.yml" down || true
      docker rename "$previous" sapienworx-caddy
      docker start sapienworx-caddy
    elif [ "$stopped" = yes ]; then
      docker start sapienworx-caddy
    fi
  fi
}
trap recover EXIT
docker stop sapienworx-caddy
stopped=yes
docker rename sapienworx-caddy "$previous"
renamed=yes
docker compose -f "$release/compose.holding.yml" up -d
ready=no
for attempt in $(seq 1 20); do
  if curl --fail --silent --show-error --resolve www.sapienworx.com:443:127.0.0.1 https://www.sapienworx.com/ -o "$release/served-index.html"; then
    ready=yes
    break
  fi
  sleep 2
done
[ "$ready" = yes ] || { echo 'Holding HTTPS did not become ready.' >&2; exit 1; }
echo "d35c4a69f4858622a5e561b4a38414b22f74f2481a08a2990014a29fb80b8188  $release/served-index.html" | sha256sum -c -
for host in sapienworx.com www.sapienworx.com; do
  for path in /api /api/v1/auth/login /health/ready; do
    status=$(curl --silent --show-error --resolve "$host:443:127.0.0.1" -o /dev/null -w '%{http_code}' "https://$host$path")
    [ "$status" = 404 ] || { echo "Unexpected public application response: $host $path $status" >&2; exit 1; }
    echo "PASS: $host $path -> 404"
  done
done
verified=yes
printf '%s\n' "$release" >runtime/holding-release
echo 'Holding page active; original application containers and data preserved.'
