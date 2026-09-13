#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-..}"
DENY='twilio|googleapis|accounts\.google\.com|oauth2|sendgrid|mailgun|openai|anthropic|firebase|auth0|clerk|stripe|telegram|slack\.com/api|graph\.microsoft\.com'

hits=$(grep -RInE "$DENY" "$ROOT" \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=vendor \
  --exclude='*.lock' --exclude='*.sum' || true)

if [[ -n "$hits" ]]; then
  echo "Forbidden third-party references detected:"
  echo "$hits"
  exit 1
fi

echo "PASS: no forbidden third-party integration references detected"
