#!/usr/bin/env bash
# Restore the production database from a .sql.gz backup.
# Usage: bash deploy/restore.sh backups/backup_YYYYMMDD_HHMMSS.sql.gz
set -euo pipefail

FILE="${1:?Usage: restore.sh <backup.sql.gz>}"
ENV_FILE="${ENV_FILE:-deploy/.env.prod}"
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

echo "WARNING: this will overwrite data in DB '${POSTGRES_DB}'."
read -r -p "Type the DB name to confirm: " confirm
[ "$confirm" = "${POSTGRES_DB}" ] || { echo "Aborted."; exit 1; }

gunzip -c "$FILE" | docker exec -i commerce_postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
echo "Restore complete from $FILE"
