#!/bin/sh
# Stage B only. Stage A never invokes this orchestrator.
set -eu
cd /opt/sapienworx-beta
test "${CONFIRM_EDGE_TRANSITION:-}" = BETA_EDGE
sha=${1:-}
exec 9>runtime/deploy.lock
flock -n 9 || { echo 'Another beta runtime/edge operation is running.' >&2; exit 1; }
python3 ./verify-private-runtime.py "$sha"
./verify-public-edge.sh
if [ ! -f edge/managed ]; then
  test "${CONFIRM_INITIAL_EDGE_TRANSITION:-}" = APPROVED_ONE_TIME_RESTART
  ./activate-shared-edge.sh --bootstrap-admin
fi
verified=no
recover() {
  if [ "$verified" = no ]; then ./rollback-shared-edge.sh; fi
}
trap recover EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
./activate-shared-edge.sh
python3 ./verify-edge-access.py
./verify-public-edge.sh
verified=yes
echo 'Stage B passed: beta TLS/health/role access verified; www/apex remain holding-only.'
