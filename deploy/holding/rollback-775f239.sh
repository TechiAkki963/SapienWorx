#!/bin/sh
# Restore the preserved application edge only when the owner requests rollback.
set -eu
cd /opt/sapienworx
exec 9>runtime/deploy.lock
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
previous=sapienworx-caddy-pre-holding-775f239
docker inspect "$previous" >/dev/null
project=$(docker inspect sapienworx-caddy --format '{{index .Config.Labels "com.docker.compose.project"}}')
[ "$project" = sapienworx-holding ] || { echo 'Current Caddy is not the expected holding service.' >&2; exit 1; }
docker compose -f /opt/sapienworx/holding/releases/775f239/compose.holding.yml down
docker rename "$previous" sapienworx-caddy
docker start sapienworx-caddy
if [ -f runtime/holding-release ]; then
  mv runtime/holding-release runtime/holding-backup-775f239/retired-release
fi
echo 'Preserved application edge restarted. Verify HTTPS and application health.'
