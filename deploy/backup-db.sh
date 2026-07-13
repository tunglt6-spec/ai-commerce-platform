#!/usr/bin/env bash
# Periodic PostgreSQL backup for AICP.
#   - Auto-detects the DB container: ai-commerce-db (co-host) OR commerce_postgres (standalone).
#   - Dumps to ./backups/backup_<UTC>.sql.gz, verifies it's non-trivial, keeps last $KEEP.
#   - Alerts on FAILURE (and optionally success) via the SHARED alert config
#     /etc/aicp-disk-alert.env: Telegram / email (SMTP) / webhook — same channels as the
#     disk watchdog, so you get one place to configure notifications.
#
#   bash deploy/backup-db.sh                # run one backup (cron target)
#   bash deploy/backup-db.sh install-cron   # add an idempotent daily 03:15 cron (root)
#
# Tunables (env or the cron line): BACKUP_KEEP (default 14), BACKUP_DIR,
#   BACKUP_NOTIFY_SUCCESS=1 (send a Telegram/email "ok" ping each run; default off).
set -u

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_PROD="${ENV_PROD:-$REPO_DIR/deploy/.env.prod}"
ALERT_ENV="${DISK_ALERT_ENV:-/etc/aicp-disk-alert.env}"
BACKUP_DIR="${BACKUP_DIR:-$REPO_DIR/backups}"
KEEP="${BACKUP_KEEP:-14}"
LOG="${BACKUP_LOG:-/var/log/aicp-backup.log}"
NOTIFY_ON_SUCCESS="${BACKUP_NOTIFY_SUCCESS:-0}"
HOST="$(hostname 2>/dev/null || echo vps)"

# --- safe KEY=VALUE loader (no `source`; tolerates <, spaces, metacharacters) ---
load_env() {
  local f="$1"
  [ -f "$f" ] || return 0
  while IFS= read -r _l || [ -n "$_l" ]; do
    _l="${_l%$'\r'}"
    case "$_l" in '' | \#*) continue ;; esac
    [ "${_l#*=}" = "$_l" ] && continue
    local k="${_l%%=*}" v="${_l#*=}"
    case "$k" in [A-Za-z_]*) export "$k=$v" ;; esac
  done <"$f"
}
load_env "$ENV_PROD"    # POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
load_env "$ALERT_ENV"   # TELEGRAM_* / SMTP_* / DISK_ALERT_WEBHOOK

# Offsite (rclone). Set BACKUP_RCLONE_REMOTE in $ALERT_ENV, e.g. "gdrive:" (folder pinned
# via root_folder_id in the rclone remote) or "gdrive:aicp-db-backups". Empty = local only.
RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:-}"
RCLONE_KEEP_DAYS="${BACKUP_RCLONE_KEEP_DAYS:-0}"  # >0 = also delete remote dumps older than N days

TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"; TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"
ALERT_EMAIL="${ALERT_EMAIL:-}"; SMTP_HOST="${SMTP_HOST:-smtp.gmail.com}"; SMTP_PORT="${SMTP_PORT:-465}"
SMTP_USER="${SMTP_USER:-}"; SMTP_PASS="${SMTP_PASS:-}"; SMTP_FROM="${SMTP_FROM:-${SMTP_USER:-}}"
WEBHOOK="${DISK_ALERT_WEBHOOK:-}"

alert() {
  local level="$1" msg="$2" line
  line="$(date -u +%FT%TZ) [$level] ${HOST} backup-db: ${msg}"
  echo "$line"; echo "$line" >>"$LOG" 2>/dev/null || true
  command -v logger >/dev/null 2>&1 && logger -t aicp-backup "$level $msg" || true
  if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ] && command -v curl >/dev/null 2>&1; then
    curl -fsS -m 10 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" --data-urlencode "text=[AICP backup ${level}] ${HOST}: ${msg}" \
      -d disable_web_page_preview=true >/dev/null 2>&1 || echo "(backup: telegram failed)"
  fi
  if [ -n "$WEBHOOK" ] && command -v curl >/dev/null 2>&1; then
    curl -fsS -m 10 -X POST -H 'Content-Type: application/json' \
      -d "{\"text\":\"[AICP backup ${level}] ${HOST}: ${msg}\",\"content\":\"[AICP backup ${level}] ${HOST}: ${msg}\"}" \
      "$WEBHOOK" >/dev/null 2>&1 || true
  fi
  if [ -n "$ALERT_EMAIL" ] && [ -n "$SMTP_USER" ] && [ -n "$SMTP_PASS" ] && command -v curl >/dev/null 2>&1; then
    printf 'From: AICP Backup <%s>\r\nTo: %s\r\nSubject: [AICP backup %s] %s\r\nDate: %s\r\n\r\n%s\r\n' \
      "$SMTP_FROM" "$ALERT_EMAIL" "$level" "$HOST" "$(date -R 2>/dev/null || date)" "$line" \
      | curl -fsS -m 20 --url "smtps://${SMTP_HOST}:${SMTP_PORT}" --ssl-reqd \
        --mail-from "$SMTP_FROM" --mail-rcpt "$ALERT_EMAIL" --user "${SMTP_USER}:${SMTP_PASS}" -T - >/dev/null 2>&1 \
      || echo "(backup: email failed)"
  fi
}

detect_container() {
  docker ps --format '{{.Names}}' 2>/dev/null | grep -E '^(ai-commerce-db|commerce_postgres)$' | head -1
}

install_cron() {
  local self marker entry
  self="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
  marker="# aicp-backup"
  entry="15 3 * * * bash ${self} >>${LOG} 2>&1 ${marker}"
  ( crontab -l 2>/dev/null | grep -vF "$marker" || true; echo "$entry" ) | crontab -
  echo "Installed cron (daily 03:15 UTC):"; echo "  $entry"
}

run_backup() {
  command -v docker >/dev/null 2>&1 || { alert CRITICAL "docker not found"; exit 1; }
  local ct; ct="$(detect_container)"
  [ -n "$ct" ] || { alert CRITICAL "no postgres container running (ai-commerce-db / commerce_postgres)"; exit 1; }
  [ -n "${POSTGRES_USER:-}" ] && [ -n "${POSTGRES_DB:-}" ] || { alert CRITICAL "POSTGRES_USER/DB not set (check $ENV_PROD)"; exit 1; }

  mkdir -p "$BACKUP_DIR"
  local ts out; ts="$(date -u +%Y%m%d_%H%M%S)"; out="$BACKUP_DIR/backup_${ts}.sql.gz"

  docker exec "$ct" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" 2>>"$LOG" | gzip >"$out"
  local st="${PIPESTATUS[0]}"
  local size; size="$(stat -c %s "$out" 2>/dev/null || echo 0)"

  if [ "$st" -ne 0 ] || [ "$size" -lt 500 ]; then
    rm -f "$out"
    alert CRITICAL "pg_dump FAILED (exit=$st, size=${size}B) from container '$ct'"
    exit 1
  fi

  # Retention: keep newest $KEEP locally.
  ls -1t "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f

  local human; human="$(du -h "$out" 2>/dev/null | cut -f1)"

  # Offsite copy (rclone) — the local backup already succeeded, so an upload failure is
  # alerted but does NOT fail the run (local copy is still safe).
  local offsite=""
  if [ -n "$RCLONE_REMOTE" ]; then
    if command -v rclone >/dev/null 2>&1; then
      if rclone copy "$out" "$RCLONE_REMOTE" --transfers 1 --retries 3 --contimeout 30s 2>>"$LOG"; then
        offsite=" +offsite($RCLONE_REMOTE)"
        # Optional offsite retention: delete remote dumps older than N days (0 = keep all).
        if [ "$RCLONE_KEEP_DAYS" -gt 0 ] 2>/dev/null; then
          rclone delete "$RCLONE_REMOTE" --include 'backup_*.sql.gz' --min-age "${RCLONE_KEEP_DAYS}d" >>"$LOG" 2>&1 || true
        fi
      else
        alert CRITICAL "offsite upload FAILED to ${RCLONE_REMOTE} (local backup kept: $(basename "$out"))"
      fi
    else
      alert WARNING "rclone not installed — offsite upload skipped (local backup kept)"
    fi
  fi

  echo "$(date -u +%FT%TZ) [OK] backup $out ($human) from $ct${offsite}"
  [ "$NOTIFY_ON_SUCCESS" = "1" ] && alert OK "backup done: $(basename "$out") ($human)${offsite}, keep=$KEEP" || true
}

case "${1:-run}" in
  install-cron) install_cron ;;
  run | "") run_backup ;;
  *) echo "usage: $0 [run|install-cron]"; exit 2 ;;
esac
