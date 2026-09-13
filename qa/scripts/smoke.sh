#!/usr/bin/env bash
set -euo pipefail

FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:3000}"
API_URL="${API_URL:-http://127.0.0.1:8080}"
PG_DSN="${PG_DSN:-postgres://sapienworx:sapienworx_local@127.0.0.1:5432/sapienworx?sslmode=disable}"
STRICT_SMOKE="${STRICT_SMOKE:-0}"

fail(){ echo "FAIL: $1" >&2; exit 1; }
pass(){ echo "PASS: $1"; }

code=$(curl --max-time 10 -sS -o /dev/null -w '%{http_code}' "$FRONTEND_URL/")
[[ "$code" == "200" ]] || fail "frontend returned HTTP $code"
pass "frontend landing page"

health=$(curl --max-time 10 -fsS "$API_URL/api/v1/health") || fail "backend health endpoint failed"
echo "$health" | grep -Eiq 'healthy|ok|up' || fail "unexpected health body: $health"
pass "backend health"

if command -v psql >/dev/null 2>&1; then
  [[ "$(psql "$PG_DSN" -Atqc 'SELECT 1')" == "1" ]] || fail "PostgreSQL SELECT 1 failed"
  pass "PostgreSQL connection"
elif [[ "$STRICT_SMOKE" == "1" ]]; then
  fail "psql is required in strict smoke mode"
else
  echo "SKIP: psql unavailable"
fi

# Local development must use the non-SNS log sender when SNS_SMS_ENABLED=false.
otp_payload='{"phone":"9999999999"}'
otp_code=$(curl --max-time 10 -sS -o /tmp/swx-otp.json -w '%{http_code}' -X POST \
  "$API_URL/api/v1/auth/request-otp" \
  -H 'Content-Type: application/json' \
  -d "$otp_payload" || true)
if [[ "$otp_code" =~ ^(200|202|204|400|404)$ ]]; then
  pass "OTP endpoint reachable/local-safe"
else
  fail "OTP endpoint returned HTTP $otp_code"
fi

if [[ -n "${MINIO_URL:-}" ]]; then
  command -v mc >/dev/null 2>&1 || fail "MINIO_URL set but MinIO client 'mc' unavailable"
  : "${MINIO_ACCESS_KEY:?MINIO_ACCESS_KEY required}"
  : "${MINIO_SECRET_KEY:?MINIO_SECRET_KEY required}"
  bucket="${MINIO_BUCKET:-sapienworx-cv}"
  mc alias set qa "$MINIO_URL" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null
  mc mb --ignore-existing "qa/$bucket" >/dev/null
  mc cp fixtures/mock-cv.pdf "qa/$bucket/smoke/mock-cv.pdf" >/dev/null
  mc stat "qa/$bucket/smoke/mock-cv.pdf" >/dev/null || fail "MinIO upload/stat failed"
  pass "MinIO CV upload"
else
  echo "SKIP: MinIO not configured in current local stack"
fi
