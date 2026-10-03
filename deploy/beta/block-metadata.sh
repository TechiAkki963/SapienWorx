#!/bin/sh
set -eu
# Host processes still use IMDS; only traffic forwarded from beta networks is blocked.
for subnet in 172.29.0.0/24 172.30.0.0/24; do
  if ! iptables -C DOCKER-USER -s "$subnet" -d 169.254.169.254/32 -j DROP 2>/dev/null; then
    iptables -I DOCKER-USER 1 -s "$subnet" -d 169.254.169.254/32 -j DROP
  fi
done
