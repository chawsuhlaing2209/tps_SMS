#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup.sql.gz>" >&2
  exit 1
fi

BACKUP_FILE="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set." >&2
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

# Safety guard: restoring OVERWRITES the target database. Non-local hosts
# (staging/production) require an explicit opt-in so a stray .env can never
# nuke customer data.
DB_HOST="$(node -e "try { console.log(new URL(process.env.DATABASE_URL).hostname) } catch { console.log('') }" 2>/dev/null || echo "")"
case "$DB_HOST" in
  localhost|127.0.0.1|::1|postgres|db) ;;
  *)
    if [[ "${ALLOW_REMOTE_DB_RESTORE:-}" != "1" ]]; then
      echo "Refusing to restore into non-local database host \"$DB_HOST\"." >&2
      echo "This would overwrite all data on that server." >&2
      echo "If intentional (e.g. refreshing staging), re-run with ALLOW_REMOTE_DB_RESTORE=1." >&2
      exit 1
    fi
    ;;
esac

echo "Restoring $BACKUP_FILE into the database configured by DATABASE_URL"
echo "This will overwrite existing data. Press Ctrl+C to abort."
sleep 3

gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL" --set ON_ERROR_STOP=1

echo "Restore complete."
