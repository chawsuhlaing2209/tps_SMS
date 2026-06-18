#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set. Copy .env.example to .env or export DATABASE_URL." >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
mkdir -p "$BACKUP_DIR"

STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
OUTPUT="$BACKUP_DIR/sms-${STAMP}.sql.gz"

echo "Writing backup to $OUTPUT"
pg_dump "$DATABASE_URL" --no-owner --no-privileges --format=plain | gzip -9 > "$OUTPUT"

find "$BACKUP_DIR" -name 'sms-*.sql.gz' -type f -mtime +14 -delete 2>/dev/null || true

echo "Backup complete."
