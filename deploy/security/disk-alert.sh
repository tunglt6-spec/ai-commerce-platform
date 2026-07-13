#!/usr/bin/env bash
# Disk-usage watchdog for the AICP VPS. Prevents a repeat of the 2026-07-13 disk-full
# incident (/ at 100% → Postgres "rejecting connections" → 502).
#
# Modes:
#   bash deploy/security/disk-alert.sh              # run one check (what cron calls)
#   bash deploy/security/disk-alert.sh install-cron # add an idempotent */15min root cron
#   bash deploy/security/disk-alert.sh test         # send a test alert then exit
#
# Behaviour:
#   - usage >= DISK_WARN  (default 85%): send a WARNING.
#   - usage >= DISK_CRIT  (default 92%): send CRITICAL + auto-reclaim (prune old
#     ai-commerce images [rmi refuses in-use → live images kept] + docker build cache),
#     then re-measure and report. PickleFund images untouched.
#
# Alert channels (all best-effort, none required):
#   - stdout (cron MAILTO gets it if mail is configured)
#   - /var/log/aicp-disk-alert.log
#   - syslog via `logger`
#   - optional webhook: export DISK_ALERT_WEBHOOK=<Slack/Discord incoming webhook URL>
#     (never commit the URL; set it in the root env or on the cron line).
set -u

WARN="${DISK_WARN:-85}"
CRIT="${DISK_CRIT:-92}"
MOUNT="${DISK_MOUNT:-/}"
WEBHOOK="${DISK_ALERT_WEBHOOK:-}"
LOG="${DISK_ALERT_LOG:-/var/log/aicp-disk-alert.log}"
HOST="$(hostname 2>/dev/null || echo vps)"

disk_pct() { df --output=pcent "$MOUNT" 2>/dev/null | tail -1 | tr -dc '0-9'; }

notify() {
  local level="$1" msg="$2" line
  line="$(date -u +%FT%TZ) [$level] ${HOST} ${MOUNT} ${msg}"
  echo "$line"
  echo "$line" >>"$LOG" 2>/dev/null || true
  command -v logger >/dev/null 2>&1 && logger -t aicp-disk "$level $MOUNT $msg" || true
  if [ -n "$WEBHOOK" ]; then
    # {text} suits Slack, {content} suits Discord — send both so either works.
    curl -fsS -m 10 -X POST -H 'Content-Type: application/json' \
      -d "{\"text\":\"[AICP disk ${level}] ${HOST} ${MOUNT} ${msg}\",\"content\":\"[AICP disk ${level}] ${HOST} ${MOUNT} ${msg}\"}" \
      "$WEBHOOK" >/dev/null 2>&1 || echo "(disk-alert: webhook post failed)"
  fi
}

reclaim() {
  command -v docker >/dev/null 2>&1 || return 0
  docker image ls 'ghcr.io/tunglt6-spec/ai-commerce-*' -q 2>/dev/null | sort -u | while read -r img; do
    [ -n "$img" ] && docker rmi "$img" >/dev/null 2>&1 || true
  done
  docker builder prune -af >/dev/null 2>&1 || true
  docker image prune -f >/dev/null 2>&1 || true
}

install_cron() {
  local self marker entry
  self="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
  marker="# aicp-disk-alert"
  entry="*/15 * * * * DISK_WARN=${WARN} DISK_CRIT=${CRIT}${WEBHOOK:+ DISK_ALERT_WEBHOOK=${WEBHOOK}} bash ${self} >>${LOG} 2>&1 ${marker}"
  ( crontab -l 2>/dev/null | grep -vF "$marker" || true; echo "$entry" ) | crontab -
  echo "Installed cron (every 15 min):"
  echo "  $entry"
}

run_check() {
  local u u2
  u="$(disk_pct)"
  if [ -z "$u" ]; then echo "disk-alert: cannot read usage of $MOUNT"; return 0; fi
  if [ "$u" -ge "$CRIT" ]; then
    notify CRITICAL "at ${u}% (>= ${CRIT}%) — auto-reclaiming disk"
    reclaim
    u2="$(disk_pct)"
    notify CRITICAL "after reclaim: ${u2:-?}%"
  elif [ "$u" -ge "$WARN" ]; then
    notify WARNING "at ${u}% (>= ${WARN}%)"
  else
    echo "disk-alert: ${MOUNT} at ${u}% — OK"
  fi
}

case "${1:-run}" in
  install-cron) install_cron ;;
  test) notify TEST "watchdog test message (usage $(disk_pct)%)" ;;
  run | "") run_check ;;
  *) echo "usage: $0 [run|install-cron|test]"; exit 2 ;;
esac
