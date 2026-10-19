#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${BACKEND_CONTAINER:?set BACKEND_CONTAINER to the running API container name}"
LIMIT_MB="${MEMORY_GROWTH_LIMIT_MB:-100}"
DURATION_SECONDS="${MEMORY_SETTLE_SECONDS:-15}"

memory_mb() {
  docker stats --no-stream --format '{{.MemUsage}}' "$CONTAINER" | awk '{print $1}' | python3 -c '
import re,sys
s=sys.stdin.read().strip()
m=re.match(r"([0-9.]+)([KMG]i?B)",s)
if not m: raise SystemExit("cannot parse memory: "+s)
n=float(m.group(1)); u=m.group(2)
print(n/1024 if u.startswith("K") else n*1024 if u.startswith("G") else n)
'
}

before=$(memory_mb)
echo "baseline_memory_mb=$before"

k6 run performance/load_test.js
sleep "$DURATION_SECONDS"

after=$(memory_mb)
growth=$(python3 - <<PY
print(float('$after') - float('$before'))
PY
)

echo "final_memory_mb=$after"
echo "growth_mb=$growth"

python3 - <<PY
limit=float('$LIMIT_MB')
growth=float('$growth')
if growth > limit:
    raise SystemExit(f'FAIL: sustained memory growth {growth:.2f} MB exceeds {limit:.2f} MB')
print(f'PASS: sustained memory growth {growth:.2f} MB <= {limit:.2f} MB')
PY
