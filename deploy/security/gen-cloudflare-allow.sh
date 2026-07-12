#!/usr/bin/env bash
# Generate an nginx allow-list of the CURRENT Cloudflare edge ranges for the AI Commerce
# vhost (AICP-H21). The commerce vhost includes /etc/nginx/conf.d/commerce-cf-allow*.conf.
#
# Usage (on the VPS):
#   bash deploy/security/gen-cloudflare-allow.sh
#   docker exec picklefund-nginx nginx -t && docker exec picklefund-nginx nginx -s reload
#
# Disable (revert):
#   rm /opt/picklefund/nginx/conf.d/commerce-cf-allow.conf
#   docker exec picklefund-nginx nginx -t && docker exec picklefund-nginx nginx -s reload
#
# NOTE: this restricts $remote_addr to Cloudflare edges — do NOT enable set_real_ip_from /
# real_ip_header on the same server, or allow/deny would evaluate the (real) client IP and
# reject everyone. The backend reads CF-Connecting-IP directly, which is trustworthy once
# only Cloudflare can reach the origin.
set -euo pipefail

OUT="${1:-/opt/picklefund/nginx/conf.d/commerce-cf-allow.conf}"
tmp="$(mktemp)"

fetch() { curl -fsSL --max-time 15 "$1"; }

{
  echo "# Auto-generated $(date -u +%FT%TZ) by gen-cloudflare-allow.sh — DO NOT edit by hand."
  echo "# Cloudflare-only ingress for the AI Commerce (store.picklefund.uk) vhost."
  for ip in $(fetch https://www.cloudflare.com/ips-v4); do echo "allow ${ip};"; done
  for ip in $(fetch https://www.cloudflare.com/ips-v6); do echo "allow ${ip};"; done
  echo "deny all;"
} >"$tmp"

# Sanity gate: refuse to install a near-empty list that would lock out all traffic.
allows="$(grep -c '^allow ' "$tmp" || true)"
if [ "${allows:-0}" -lt 8 ]; then
  echo "ERROR: only ${allows} Cloudflare ranges fetched — refusing to write (would deny all)." >&2
  rm -f "$tmp"
  exit 1
fi

mv "$tmp" "$OUT"
echo "Wrote ${OUT} (${allows} allow rules). Now run:"
echo "  docker exec picklefund-nginx nginx -t && docker exec picklefund-nginx nginx -s reload"
