#!/bin/sh
set -eu
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
for host in sapienworx.com www.sapienworx.com; do
  curl --fail --silent --show-error --max-time 10 --resolve "$host:443:127.0.0.1" "https://$host/" -o "$tmp"
  echo "d35c4a69f4858622a5e561b4a38414b22f74f2481a08a2990014a29fb80b8188  $tmp" | sha256sum -c -
  curl --fail --silent --show-error --max-time 10 --resolve "$host:443:127.0.0.1" "https://$host/mascot.png" -o "$tmp"
  echo "3cd3d1027b374dbedc415bdd3405d6544b4f339290401ce1268f0347f4f04dc4  $tmp" | sha256sum -c -
  for path in /api /api/v1/auth/login /health/ready /admin /recruiter /candidate; do
    test "$(curl --silent --show-error --max-time 10 --resolve "$host:443:127.0.0.1" -o /dev/null -w '%{http_code}' "https://$host$path")" = 404
  done
done
