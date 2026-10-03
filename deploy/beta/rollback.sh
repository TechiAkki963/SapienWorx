#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
KNOWN_GOOD_SHA="${1:-}"

case "$KNOWN_GOOD_SHA" in
  *[!0-9a-f]*|'') echo "Rollback target must be a full lowercase Git SHA." >&2; exit 2 ;;
esac
[ "${#KNOWN_GOOD_SHA}" -eq 40 ] || { echo "Rollback target must be exactly 40 hexadecimal characters." >&2; exit 2; }

echo "Rolling application containers back without reversing database migrations."
SKIP_MIGRATIONS=true "${ROOT_DIR}/deploy.sh" "$KNOWN_GOOD_SHA"
