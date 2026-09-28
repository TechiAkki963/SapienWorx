#!/bin/sh
# This file must retain LF line endings because it is a Linux container entrypoint.
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

for migration in /migrations/*.up.sql; do
  version="$(basename "$migration" .up.sql)"
  raw_checksum="$(sha256sum "$migration" | awk '{print $1}')"
  # Windows checkouts may use CRLF while an earlier migration was applied with LF.
  # Compare both encodings without allowing any SQL-content drift.
  checksum="$(sed 's/\r$//' "$migration" | sha256sum | awk '{print $1}')"
  crlf_checksum="$(sed 's/\r$//' "$migration" | sed 's/$/\r/' | sha256sum | awk '{print $1}')"
  applied_checksum="$(psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "SELECT checksum FROM schema_migrations WHERE version = '$version';")"

  if [ -n "$applied_checksum" ]; then
    if [ "$applied_checksum" != "$checksum" ] && [ "$applied_checksum" != "$crlf_checksum" ] && [ "$applied_checksum" != "$raw_checksum" ]; then
      echo "Migration drift detected for $version" >&2
      exit 1
    fi
    echo "Skipping already-applied migration $version"
    continue
  fi

  echo "Applying migration $version"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations(version, checksum) VALUES ('$version', '$checksum');"
done

echo "Database migrations are current."
