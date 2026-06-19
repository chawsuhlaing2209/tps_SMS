#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Stopping containers and removing volumes..."
docker compose down -v

echo "Starting containers..."
docker compose up -d

echo "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U sms -d sms >/dev/null 2>&1; then
    echo "PostgreSQL is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "PostgreSQL did not become ready in time." >&2
    exit 1
  fi
  sleep 1
done

echo "Applying migrations..."
npm run db:migrate

echo "Seeding demo data..."
npm run db:seed

echo "Database reset complete."
echo "Sign in again in the browser — your previous session is no longer valid."
