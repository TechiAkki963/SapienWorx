"""Fault-inject prepared operator scripts in a disposable container, never on EC2."""
import pathlib
import subprocess
import tempfile
import uuid

root = pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='edge-ops-', dir=root / 'tmp') as temp:
    work = pathlib.Path(temp)
    harness = r'''set -eu
mkdir -p /opt/sapienworx-beta/edge /opt/sapienworx-beta/runtime /opt/sapienworx/runtime /opt/sapienworx/holding/releases/775f239 /mocks
cp /repo/deploy/beta/*sh /repo/deploy/beta/Caddyfile* /repo/deploy/beta/compose.edge.yml /opt/sapienworx-beta/
cp /repo/deploy/holding/Caddyfile /opt/sapienworx/holding/releases/775f239/Caddyfile
touch /opt/sapienworx/runtime/holding-release /opt/sapienworx-beta/runtime/deployed-sha
printf '#!/bin/sh\nexit 0\n' > /opt/sapienworx-beta/verify-public-edge.sh
cat > /mocks/docker <<'MOCK'
#!/bin/sh
echo "$*" >> /calls
case "$*" in
  *'caddy version') echo 'v2.10.2 test' ;;
  *'cat /etc/caddy/Caddyfile') cat /repo/deploy/holding/Caddyfile ;;
  'inspect --format '{{.State.Health.Status}}*) echo healthy ;;
esac
MOCK
printf '#!/bin/sh\nexit 0\n' > /mocks/flock
printf '#!/bin/sh\necho 13.206.138.176\n' > /mocks/getent
printf '#!/bin/sh\necho 1\n' > /mocks/seq
printf '#!/bin/sh\nexit 0\n' > /mocks/sleep
printf '#!/bin/sh\nexit "${FAIL_TLS:-0}"\n' > /mocks/curl
chmod +x /mocks/* /opt/sapienworx-beta/*sh
sed -i 's/\r$//' /opt/sapienworx-beta/*sh
export PATH=/mocks:$PATH
cd /opt/sapienworx-beta
# Unapproved initial restart is refused, as is reload before managed bootstrap.
if ./activate-shared-edge.sh --bootstrap-admin; then exit 1; fi
if ./activate-shared-edge.sh; then exit 1; fi
! grep -q -- '--force-recreate' /calls
CONFIRM_INITIAL_EDGE_TRANSITION=APPROVED_ONE_TIME_RESTART ./activate-shared-edge.sh --bootstrap-admin
test -f edge/managed
cmp edge/Caddyfile Caddyfile.holding-admin
test "$(grep -c -- '--force-recreate' /calls)" = 1
: > /calls
# TLS failure must restore the holding-only file and reload, with no recreation.
if FAIL_TLS=1 ./activate-shared-edge.sh; then exit 1; fi
cmp edge/Caddyfile Caddyfile.holding-admin
test "$(grep -c 'caddy reload' /calls)" = 2
! grep -q -- '--force-recreate' /calls
: > /calls
./activate-shared-edge.sh
cmp edge/Caddyfile Caddyfile.shared
./rollback-shared-edge.sh
cmp edge/Caddyfile Caddyfile.holding-admin
test "$(grep -c 'caddy reload' /calls)" = 2
! grep -q -- '--force-recreate' /calls
echo 'PASS: explicit restart gate; managed prerequisite; failed TLS restores holding config; activation/rollback use reload only.'
'''
    (work / 'harness.sh').write_text(harness, newline='\n')
    result = subprocess.run(['docker', 'run', '--rm', '--network', 'none', '-v', f'{root}:/repo:ro', '-v', f'{work}:/test:ro', 'alpine:3.21', 'sh', '/test/harness.sh'], capture_output=True, text=True)
    output = result.stdout + result.stderr
    (root / 'docs/p3/evidence/edge-transition/operator-tests.txt').write_text(output)
    print(output)
    assert result.returncode == 0, 'Operator fault-injection rehearsal failed'
