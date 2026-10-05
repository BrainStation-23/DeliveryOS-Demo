#!/usr/bin/env bash
# ==============================================================================
# DeliveryOS — Automated PostgreSQL Database Backup Script
# Daily / On-Demand Backup, 7-Day Local Retention, Optional Offsite Upload
#
# Offsite upload (optional, one of):
#   BACKUP_OFFSITE_TARGET=s3://bucket/path   → requires AWS CLI
#   BACKUP_OFFSITE_TARGET=rclone:remote/path → requires rclone
# Schedule with cron/systemd (see deploy/README.md § Backups).
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/backups"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_FILE="$BACKUP_DIR/deliveryos_backup_${TIMESTAMP}.sql.gz"
CONTAINER_NAME="${DB_CONTAINER:-deliveryos_db}"

# Load DB credentials from the repo-root .env when not exported
if [ -z "${DB_PASSWORD:-}" ] && [ -f "$PROJECT_ROOT/.env" ]; then
  # shellcheck disable=SC1091
  set -a
  . "$PROJECT_ROOT/.env"
  set +a
fi
DB_NAME="${DB_NAME:-deliveryos}"
DB_USER="${DB_USER:-postgres}"
: "${DB_PASSWORD:?DB_PASSWORD is required (export it or define it in .env)}"

mkdir -p "$BACKUP_DIR"

echo "===================================================="
echo " DeliveryOS PostgreSQL Database Backup"
echo "===================================================="
echo "Timestamp:      $TIMESTAMP"
echo "Target Container: $CONTAINER_NAME"
echo "Database:       $DB_NAME"
echo "Backup Path:    $BACKUP_FILE"
echo "----------------------------------------------------"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}\$"; then
  echo "❌ Error: Docker container '$CONTAINER_NAME' is not currently running!"
  exit 1
fi

echo "📦 Dumping database and compressing with gzip..."
docker exec -e PGPASSWORD="$DB_PASSWORD" "$CONTAINER_NAME" pg_dump -h localhost -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner | gzip > "$BACKUP_FILE"

# Verify backup was created and has non-zero size
if [ -s "$BACKUP_FILE" ]; then
  BACKUP_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
  echo "✅ Database backup created successfully! Size: $BACKUP_SIZE"
else
  echo "❌ Backup file was created empty or failed!"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Offsite upload (env-gated; the local copy always remains)
TARGET="${BACKUP_OFFSITE_TARGET:-}"
if [ -n "$TARGET" ]; then
  echo "☁️  Uploading backup offsite to $TARGET ..."
  case "$TARGET" in
    s3://*)
      if aws s3 cp "$BACKUP_FILE" "$TARGET/$(basename "$BACKUP_FILE")" --only-show-errors; then
        echo "✅ Offsite upload complete (S3)."
      else
        echo "❌ Offsite S3 upload FAILED — local copy retained."
        exit 1
      fi ;;
    rclone:*)
      if rclone copy "$BACKUP_FILE" "$TARGET"; then
        echo "✅ Offsite upload complete (rclone)."
      else
        echo "❌ Offsite rclone upload FAILED — local copy retained."
        exit 1
      fi ;;
    *)
      echo "⚠️  Unknown BACKUP_OFFSITE_TARGET scheme — skipping offsite upload." ;;
  esac
else
  echo "ℹ️  BACKUP_OFFSITE_TARGET not set — local-only backup."
fi

# Retention policy: Purge local backups older than 7 days
echo "🧹 Applying 7-day retention cleanup policy..."
DELETED_COUNT=0
while IFS= read -r old_file; do
  if [ -n "$old_file" ]; then
    rm -f "$old_file"
    echo "   Removed expired backup: $(basename "$old_file")"
    DELETED_COUNT=$((DELETED_COUNT + 1))
  fi
done < <(find "$BACKUP_DIR" -name "deliveryos_backup_*.sql.gz" -type f -mtime +7)

echo "   Expired backups purged: $DELETED_COUNT"
echo "🎉 PostgreSQL Backup Complete!"
echo "===================================================="
