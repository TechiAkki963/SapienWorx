#!/usr/bin/env bash
set -euo pipefail

WEB_URL="${WEB_URL:-http://127.0.0.1:3000}"
API_URL="${API_URL:-http://127.0.0.1:8080}"
DATABASE_URL="${DATABASE_URL:-}"
AUDIT_ACCESS_TOKEN="${AUDIT_ACCESS_TOKEN:-}"
AUDIT_WS_THREAD_ID="${AUDIT_WS_THREAD_ID:-}"

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
pass() { printf 'PASS: %s\n' "$1"; }

status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 "$WEB_URL/")" || fail "frontend request failed"
[[ "$status" == "200" ]] || fail "frontend returned HTTP $status"
pass "Next.js frontend HTTP 200"

status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 "$API_URL/health/live")" || fail "backend health request failed"
[[ "$status" == "200" ]] || fail "backend health returned HTTP $status"
pass "Go backend health HTTP 200"

command -v pg_isready >/dev/null 2>&1 || fail "pg_isready is not installed"
[[ -n "$DATABASE_URL" ]] || fail "DATABASE_URL is required for PostgreSQL smoke testing"
pg_isready -d "$DATABASE_URL" -t 5 >/dev/null || fail "PostgreSQL is not accepting connections"
pass "PostgreSQL accepts connections"

[[ -n "$AUDIT_ACCESS_TOKEN" ]] || fail "AUDIT_ACCESS_TOKEN is required for WebSocket smoke testing"
[[ -n "$AUDIT_WS_THREAD_ID" ]] || fail "AUDIT_WS_THREAD_ID is required for WebSocket smoke testing"

headers_file="$(mktemp)"
trap 'rm -f "$headers_file"' EXIT
set +e
curl --http1.1 -sS --max-time 5 -D "$headers_file" -o /dev/null \
  -H 'Connection: Upgrade' \
  -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Version: 13' \
  -H 'Sec-WebSocket-Key: U2FwaWVuV29yeEF1ZGl0IQ==' \
  -H "Authorization: Bearer $AUDIT_ACCESS_TOKEN" \
  "$API_URL/api/v1/messaging/threads/$AUDIT_WS_THREAD_ID/ws"
curl_exit=$?
set -e

# curl commonly exits 28 after the upgrade because the WebSocket remains open;
# the HTTP 101 response is the smoke-test success criterion.
grep -Eq '^HTTP/[0-9.]+ 101([[:space:]]|$)' "$headers_file" || {
  cat "$headers_file" >&2
  fail "WebSocket did not return HTTP 101 (curl exit $curl_exit)"
}
pass "WebSocket endpoint upgrades to HTTP 101"

printf 'All critical-path smoke checks passed.\n'
