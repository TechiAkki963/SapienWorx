#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-..}"
DENY='twilio|googleapis|accounts\.google\.com|oauth2|sendgrid|mailgun|openai|anthropic|firebase|auth0|clerk|stripe|telegram|slack\.com/api|graph\.microsoft\.com'

# Scan executable/configuration surfaces only. Documentation intentionally names
# forbidden providers to describe the policy and must not create false positives.
targets=()
for dir in frontend backend infrastructure scripts; do
  [[ -e "$ROOT/$dir" ]] && targets+=("$ROOT/$dir")
done

if [[ ${#targets[@]} -eq 0 ]]; then
  echo "FAIL: no source directories found to scan" >&2
  exit 1
fi

hits=$(grep -RInEi "$DENY" "${targets[@]}" \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=vendor \
  --exclude='*.lock' --exclude='*.sum' \
  --include='*.go' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' \
  --include='*.cjs' --include='*.json' --include='*.yaml' --include='*.yml' --include='*.toml' \
  --include='*.tf' --include='*.sh' --include='Dockerfile*' || true)

if [[ -n "$hits" ]]; then
  echo "Forbidden third-party integration references detected:"
  echo "$hits"
  exit 1
fi

echo "PASS: executable code contains no forbidden third-party integration references"
