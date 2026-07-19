#!/bin/sh
set -eu

umask 077

DB_PATH="${DB_PATH:-/data/prod.db}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_DATE="$(date +%F)"
BACKUP_PATH="${BACKUP_DIR}/prod-${BACKUP_DATE}.db"

if [ ! -f "$DB_PATH" ]; then
  echo "ERROR: SQLite database not found at $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# SQLite's online backup API is safe against a live database in WAL mode.
sqlite3 "$DB_PATH" ".backup '$BACKUP_PATH'"

INTEGRITY_RESULT="$(sqlite3 "$BACKUP_PATH" "PRAGMA integrity_check;")"
if [ "$INTEGRITY_RESULT" != "ok" ]; then
  echo "ERROR: Backup integrity check failed: $INTEGRITY_RESULT" >&2
  exit 1
fi

# Retain today's backup plus the previous 13 daily backups.
find "$BACKUP_DIR" -type f -name 'prod-????-??-??.db' -mtime +13 -delete

# TODO: Configure exactly one off-box target in the cron environment.
if [ -n "${RCLONE_TARGET:-}" ] && [ -n "${SCP_TARGET:-}" ]; then
  echo "ERROR: Configure only one of RCLONE_TARGET or SCP_TARGET." >&2
  exit 1
elif [ -n "${RCLONE_TARGET:-}" ]; then
  rclone copyto "$BACKUP_PATH" "${RCLONE_TARGET%/}/$(basename "$BACKUP_PATH")"
  echo "Backup copied with rclone to ${RCLONE_TARGET%/}/"
elif [ -n "${SCP_TARGET:-}" ]; then
  scp "$BACKUP_PATH" "$SCP_TARGET"
  echo "Backup copied with scp to $SCP_TARGET"
else
  echo "WARNING: Local backup created, but no RCLONE_TARGET or SCP_TARGET is configured." >&2
fi

echo "Backup complete: $BACKUP_PATH"
