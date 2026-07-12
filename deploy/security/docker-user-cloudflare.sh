#!/usr/bin/env bash
# Network-layer Cloudflare-only ingress for a Docker-published nginx (AICP-H21).
#
# WHY DOCKER-USER (not ufw): Docker inserts its own iptables rules that BYPASS ufw for
# published ports, so `ufw deny` does NOT block traffic to a container's -p 443:443.
# The DOCKER-USER chain is evaluated for all container traffic and is the supported hook.
#
# This ALLOWS 80/443 only from current Cloudflare ranges and DROPs the rest. SSH and every
# other port are untouched (no lockout of admin access).
#
# Usage (VPS, as root):   bash deploy/security/docker-user-cloudflare.sh apply
# Revert:                 bash deploy/security/docker-user-cloudflare.sh flush
# Persist across reboot:  apt-get install -y iptables-persistent && netfilter-persistent save
#
# SAFETY: run inside `tmux`/`screen` and keep a second SSH session open while testing.
set -euo pipefail

ACTION="${1:-apply}"
PORTS="80,443"
CMT="cf-ingress"

flush() {
  for BIN in iptables ip6tables; do
    # Remove every DOCKER-USER rule we tagged, then ensure the chain still RETURNs.
    while $BIN -L DOCKER-USER -n --line-numbers 2>/dev/null | grep -q "$CMT"; do
      n=$($BIN -L DOCKER-USER -n --line-numbers | awk -v c="$CMT" '$0 ~ c {print $1; exit}')
      $BIN -D DOCKER-USER "$n"
    done
  done
  echo "Flushed ${CMT} rules from DOCKER-USER (iptables + ip6tables)."
}

apply() {
  command -v iptables >/dev/null || { echo "iptables not found"; exit 1; }
  flush  # idempotent: clear previous run first
  local v4 v6
  v4=$(curl -fsSL --max-time 15 https://www.cloudflare.com/ips-v4)
  v6=$(curl -fsSL --max-time 15 https://www.cloudflare.com/ips-v6)
  [ "$(printf '%s\n' "$v4" | wc -l)" -ge 5 ] || { echo "Too few CF v4 ranges — abort"; exit 1; }

  # Allow already-established connections (so responses/return traffic are unaffected).
  iptables  -I DOCKER-USER -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN -m comment --comment "$CMT"
  ip6tables -I DOCKER-USER -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN -m comment --comment "$CMT"

  # Allow Cloudflare edges to 80/443.
  for ip in $v4; do
    iptables  -I DOCKER-USER -s "$ip" -p tcp -m multiport --dports "$PORTS" -j RETURN -m comment --comment "$CMT"
  done
  for ip in $v6; do
    ip6tables -I DOCKER-USER -s "$ip" -p tcp -m multiport --dports "$PORTS" -j RETURN -m comment --comment "$CMT"
  done

  # Drop everything else headed to 80/443 (appended = evaluated after the allow rules).
  iptables  -A DOCKER-USER -p tcp -m multiport --dports "$PORTS" -j DROP -m comment --comment "$CMT"
  ip6tables -A DOCKER-USER -p tcp -m multiport --dports "$PORTS" -j DROP -m comment --comment "$CMT"

  echo "Applied Cloudflare-only ingress on ${PORTS}. Verify, then persist with netfilter-persistent save."
}

case "$ACTION" in
  apply) apply ;;
  flush) flush ;;
  *) echo "usage: $0 [apply|flush]"; exit 2 ;;
esac
