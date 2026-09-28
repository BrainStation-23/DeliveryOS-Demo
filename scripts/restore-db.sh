#!/usr/bin/env bash
# ==============================================================================
# DeliveryOS — PostgreSQL Restore Script
# Restores a backup produced by backup-db.sh into the running DB container.
#
# Usage:
#   ./scripts/restore-db.sh backups/deliveryos_backup_20260928_120000.sql.gz
#
# ⚠️  The target database is REPLACED (--clean --if-exists). Double-check the
#     file argument; consider taking a fresh backup immediately beforehand.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTAINER_NAME="${DB_CONTAINER:-deliveryos_db}"

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <path-to-deliveryos_backup_*.sql.gz>" >&2
  exit 1
fi

BACKUP_FILE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
if [ ! -s "$BACKUP_FILE" ]; then
  echo "❌ Backup file not found or empty: $BACKUP_FILE" >&2
  exit 1
fi

if [ -z "${DB_PASSWORD:-}" ] && [ -f "$PROJECT_ROOT/.env" ]; then
  # shellcheck disable=SC1091
  set -a
  . "$PROJECT_ROOT/.env"
  set +a
fi
DB_NAME="${DB_NAME:-deliveryos}"
DB_USER="${DB_USER:-postgres}"
: "${DB_PASSWORD:?DB_PASSWORD is required (export it or define it in .env)}"

if ! docker ps --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}\$"; then
  echo "❌ Error: Docker container '$CONTAINER_NAME' is not currently running!" >&2
  exit 1
fi

echo "===================================================="
echo " DeliveryOS PostgreSQL Restore"
echo "===================================================="
echo "Source:   $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
echo "Target:   container=$CONTAINER_NAME db=$DB_NAME"
echo "----------------------------------------------------"
read -r -p "This REPLACES the current database. Type the DB name to confirm: " CONFIRM
if [ "$CONFIRM" != "$DB_NAME" ]; then
  echo "Aborted."
  exit 1
fi

echo "📥 Restoring..."
gunzip -c "$BACKUP_FILE" | docker exec -e PGPASSWORD="$DB_PASSWORD" -i "$CONTAINER_NAME" \
  psql -h localhost -U "$DB_USER" -d "$DB_NAME" -q

echo "✅ Restore complete. Running a sanity count..."
docker exec -e PGPASSWORD="$DB_PASSWORD" "$CONTAINER_NAME" \
  psql -h localhost -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM orders;"
echo "🎉 PostgreSQL Restore Complete!"
echo "===================================================="
