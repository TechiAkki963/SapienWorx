#!/bin/sh
# Review-only. Requires separate host-rule approval before --apply.
# No production/Caddy rule is edited. Only the scanner-owned destination/port.
set -eu
case "${1:-}" in --check|--apply) ;; *) echo 'Use --check or separately approved --apply' >&2; exit 2;; esac
backend_ip=$(docker inspect sapienworx-beta-backend --format '{{(index .NetworkSettings.Networks "sapienworx_beta_proxy").IPAddress}}')
case "$backend_ip" in 172.29.0.*) ;; *) echo 'Unexpected beta backend network' >&2; exit 1;; esac
if [ "$1" = --apply ]; then
  iptables -N SWX_BETA_SCANNER 2>/dev/null || true
  # Reject while refreshing: an old container IP must never retain access.
  iptables -I SWX_BETA_SCANNER 1 -j REJECT
  for old_source in $(iptables -S SWX_BETA_SCANNER | awk '$1=="-A" && $3=="-s" && $5=="-j" && $6=="ACCEPT" {print $4}'); do
    case "$old_source" in 172.29.0.*) ;; *) echo 'Unexpected rule in scanner-owned chain' >&2; exit 1;; esac
    iptables -D SWX_BETA_SCANNER -s "$old_source" -j ACCEPT
  done
  iptables -I SWX_BETA_SCANNER 1 -s "$backend_ip/32" -j ACCEPT
  iptables -C DOCKER-USER -d 10.42.20.0/24 -p tcp --dport 3310 -j SWX_BETA_SCANNER 2>/dev/null || iptables -I DOCKER-USER 1 -d 10.42.20.0/24 -p tcp --dport 3310 -j SWX_BETA_SCANNER
  iptables -C OUTPUT -d 10.42.20.0/24 -p tcp --dport 3310 -j REJECT 2>/dev/null || iptables -I OUTPUT 1 -d 10.42.20.0/24 -p tcp --dport 3310 -j REJECT
fi
iptables -C SWX_BETA_SCANNER -s "$backend_ip/32" -j ACCEPT
iptables -C SWX_BETA_SCANNER -j REJECT
iptables -C DOCKER-USER -d 10.42.20.0/24 -p tcp --dport 3310 -j SWX_BETA_SCANNER
iptables -C OUTPUT -d 10.42.20.0/24 -p tcp --dport 3310 -j REJECT
echo 'Scanner-specific beta backend egress rules present; verify production-container denial before activation.'
