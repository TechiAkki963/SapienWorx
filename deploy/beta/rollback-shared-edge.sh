#!/bin/sh
# Return to holding-only through the local admin API; keep certificates and data.
set -eu
umask 077
cd /opt/sapienworx-beta
exec 9>/opt/sapienworx/runtime/deploy.lock
flock -n 9 || exit 1
test -f edge/managed
cp Caddyfile.holding-admin edge/rollback
docker exec sapienworx-caddy caddy validate --config /etc/caddy/rollback --adapter caddyfile
cp edge/Caddyfile edge/previous
mv edge/rollback edge/Caddyfile
if ! docker exec sapienworx-caddy caddy reload --address 127.0.0.1:2020 --config /etc/caddy/Caddyfile --adapter caddyfile; then
  cp edge/previous edge/restore.tmp
  mv edge/restore.tmp edge/Caddyfile
  docker exec sapienworx-caddy caddy reload --address 127.0.0.1:2020 --config /etc/caddy/Caddyfile --adapter caddyfile
  exit 1
fi
./verify-public-edge.sh
echo 'Holding-only edge restored gracefully; beta containers/database/uploads unchanged.'
