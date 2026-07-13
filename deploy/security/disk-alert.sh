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

# Optional secrets/config file (keep SMTP creds OUT of git and out of the crontab line).
# Create it chmod 600 on the VPS, e.g. /etc/aicp-disk-alert.env with:
#   ALERT_EMAIL=tunglt6@gmail.com
#   SMTP_USER=your@gmail.com
#   SMTP_PASS=<16-char Gmail App Password>
ENV_FILE="${DISK_ALERT_ENV:-/etc/aicp-disk-alert.env}"
# Load KEY=VALUE lines WITHOUT sourcing — so a value containing <, spaces, or other
# shell metacharacters can't break the script or execute code (defensive parsing).
if [ -f "$ENV_FILE" ]; then
  while IFS= read -r _line || [ -n "$_line" ]; do
    _line="${_line%$'\r'}"                       # strip CR (CRLF files)
    case "$_line" in '' | \#*) continue ;; esac  # skip blanks/comments
    [ "${_line#*=}" = "$_line" ] && continue     # no '=' → skip
    _k="${_line%%=*}"; _v="${_line#*=}"
    case "$_k" in [A-Za-z_]*) export "$_k=$_v" ;; esac
  done <"$ENV_FILE"
  unset _line _k _v
fi

WARN="${DISK_WARN:-85}"
CRIT="${DISK_CRIT:-92}"
MOUNT="${DISK_MOUNT:-/}"
WEBHOOK="${DISK_ALERT_WEBHOOK:-}"
LOG="${DISK_ALERT_LOG:-/var/log/aicp-disk-alert.log}"
HOST="$(hostname 2>/dev/null || echo vps)"

# Email (via curl SMTP; no MTA needed). All optional — set in $ENV_FILE.
ALERT_EMAIL="${ALERT_EMAIL:-}"
SMTP_HOST="${SMTP_HOST:-smtp.gmail.com}"
SMTP_PORT="${SMTP_PORT:-465}"
SMTP_USER="${SMTP_USER:-}"
SMTP_PASS="${SMTP_PASS:-}"
SMTP_FROM="${SMTP_FROM:-${SMTP_USER:-}}"

# Telegram (via Bot API; most reliable from a VPS). Optional — set in $ENV_FILE:
#   TELEGRAM_BOT_TOKEN=<from @BotFather>
#   TELEGRAM_CHAT_ID=<your chat/group id>
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

disk_pct() { df --output=pcent "$MOUNT" 2>/dev/null | tail -1 | tr -dc '0-9'; }

send_email() {
  local subject="$1" body="$2" msg
  [ -n "$ALERT_EMAIL" ] && [ -n "$SMTP_USER" ] && [ -n "$SMTP_PASS" ] || return 0
  command -v curl >/dev/null 2>&1 || return 0
  msg="$(printf 'From: AICP Disk Alert <%s>\r\nTo: %s\r\nSubject: %s\r\nDate: %s\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s\r\n' \
    "$SMTP_FROM" "$ALERT_EMAIL" "$subject" "$(date -R 2>/dev/null || date)" "$body")"
  printf '%s' "$msg" | curl -fsS -m 20 --url "smtps://${SMTP_HOST}:${SMTP_PORT}" --ssl-reqd \
    --mail-from "$SMTP_FROM" --mail-rcpt "$ALERT_EMAIL" \
    --user "${SMTP_USER}:${SMTP_PASS}" -T - >/dev/null 2>&1 \
    || echo "(disk-alert: email send failed — check SMTP creds / Gmail App Password)"
}

send_telegram() {
  local text="$1"
  [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ] || return 0
  command -v curl >/dev/null 2>&1 || return 0
  curl -fsS -m 10 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${text}" \
    -d "disable_web_page_preview=true" >/dev/null 2>&1 \
    || echo "(disk-alert: telegram post failed — check bot token / chat id)"
}

notify() {
  local level="$1" msg="$2" line
  line="$(date -u +%FT%TZ) [$level] ${HOST} ${MOUNT} ${msg}"
  echo "$line"
  echo "$line" >>"$LOG" 2>/dev/null || true
  command -v logger >/dev/null 2>&1 && logger -t aicp-disk "$level $MOUNT $msg" || true
  send_telegram "[AICP disk ${level}] ${HOST} — disk ${MOUNT} ${msg}"
  if [ -n "$WEBHOOK" ]; then
    # {text} suits Slack, {content} suits Discord — send both so either works.
    curl -fsS -m 10 -X POST -H 'Content-Type: application/json' \
      -d "{\"text\":\"[AICP disk ${level}] ${HOST} ${MOUNT} ${msg}\",\"content\":\"[AICP disk ${level}] ${HOST} ${MOUNT} ${msg}\"}" \
      "$WEBHOOK" >/dev/null 2>&1 || echo "(disk-alert: webhook post failed)"
  fi
  send_email "[AICP disk ${level}] ${HOST} — disk ${MOUNT}" "$line"
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
