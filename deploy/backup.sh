#!/usr/bin/env bash
# Backup the production database to ./backups/backup_<UTC>.sql.gz
# Usage: bash deploy/backup.sh
set -euo pipefail

ENV_FILE="${ENV_FILE:-deploy/.env.prod}"
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

mkdir -p backups
TS=$(date -u +%Y%m%d_%H%M%S)
OUT="backups/backup_${TS}.sql.gz"

docker exec commerce_postgres pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" | gzip > "$OUT"
echo "Backup written: $OUT ($(du -h "$OUT" | cut -f1))"

# Retention: keep last 30 backups.
ls -1t backups/backup_*.sql.gz | tail -n +31 | xargs -r rm -f
