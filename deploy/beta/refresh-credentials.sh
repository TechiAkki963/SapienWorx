#!/bin/sh
set -eu
umask 077
root=/opt/sapienworx-beta
"$root/block-metadata.sh"
export AWS_PROFILE=beta AWS_CONFIG_FILE="$root/runtime/aws-config"
identity=$(aws sts get-caller-identity --query Arn --output text)
case "$identity" in arn:aws:sts::*:assumed-role/sapienworx-beta-application/*) ;; *) echo 'Unexpected runtime role.' >&2; exit 1 ;; esac
install -d -m 0700 -o 10001 -g 10001 "$root/runtime/aws-credentials"
temp=$(mktemp "$root/runtime/aws-credentials/current.XXXXXX")
trap 'rm -f "$temp"' EXIT
aws configure export-credentials --profile beta --format process >"$temp"
python3 - "$temp" <<'PY'
import json, sys
from datetime import datetime, timezone
with open(sys.argv[1]) as stream:
    credentials = json.load(stream)
assert credentials['Version'] == 1
assert all(credentials.get(key) for key in ('AccessKeyId', 'SecretAccessKey', 'SessionToken', 'Expiration'))
assert datetime.fromisoformat(credentials['Expiration'].replace('Z', '+00:00')) > datetime.now(timezone.utc)
PY
chown 10001:10001 "$temp"
chmod 0600 "$temp"
mv "$temp" "$root/runtime/aws-credentials/current.json"
trap - EXIT
