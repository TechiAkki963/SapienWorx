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

live=$(curl --max-time 10 -fsS "$API_URL/health/live") || fail "backend liveness failed"
echo "$live" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' || fail "unexpected liveness body: $live"
pass "backend liveness"

ready=$(curl --max-time 10 -fsS "$API_URL/health/ready") || fail "backend readiness failed"
echo "$ready" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"ready"' || fail "unexpected readiness body: $ready"
pass "backend readiness/database dependency"

if command -v psql >/dev/null 2>&1; then
  [[ "$(psql "$PG_DSN" -Atqc 'SELECT 1')" == "1" ]] || fail "PostgreSQL SELECT 1 failed"
  pass "PostgreSQL SELECT 1"
elif [[ "$STRICT_SMOKE" == "1" ]]; then
  fail "psql is required in strict smoke mode"
else
  echo "SKIP: psql unavailable"
fi

# OTP transport can only be asserted deterministically for an existing QA account.
if [[ -n "${SMOKE_OTP_EMAIL:-}" ]]; then
  otp=$(curl --max-time 10 -fsS -X POST "$API_URL/api/v1/auth/otp/resend" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${SMOKE_OTP_EMAIL}\"}") || fail "OTP resend request failed"
  echo "$otp" | grep -Eq '"accepted"[[:space:]]*:[[:space:]]*true' || fail "OTP resend not accepted: $otp"
  if [[ "${APP_ENV:-development}" != "production" ]]; then
    echo "$otp" | grep -q 'development_otp' || fail "development OTP was not exposed by local mock transport"
  fi
  pass "local OTP transport"
else
  echo "SKIP: set SMOKE_OTP_EMAIL to validate local OTP transport"
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
