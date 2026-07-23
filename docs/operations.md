# Operations guide

Staging and production deployment notes for the SMS monorepo.

> New to environments, releases, or git management? Start with the
> plain-language [Staging → Production Playbook](./staging-to-production-playbook.md)
> — this document is its technical companion.

## Environment files

| File | Purpose |
|------|---------|
| `.env.example` | Local development defaults |
| `.env.staging.example` | Staging/production template — copy values into your host's secret manager |

Minimum variables:

- `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`
- `WEB_APP_URL`, `API_ALLOWED_ORIGINS`, `NEXT_PUBLIC_API_BASE_URL`
- S3 credentials and `EMAIL_PROVIDER` config

Never commit real secrets. Use your platform's secret store (Render, Fly.io, AWS SSM, etc.).

## Deploy checklist

1. Provision PostgreSQL 16+, Redis, and S3-compatible object storage.
2. Set environment variables from `.env.staging.example`.
3. Run migrations before starting API/worker:
   ```bash
   npm run db:migrate
   ```
4. Build and start services:
   ```bash
   npm run build
   # API, web, and worker per your process manager
   ```
5. Smoke test: health check, login, tenant isolation (two demo tenants if seeded).

CI already runs `db:migrate` and `db:seed` against Postgres before tests (`.github/workflows/ci.yml`).

## Database backups

### Create a backup

Requires `pg_dump` and `gzip` on the host running the script.

```bash
chmod +x scripts/db-backup.sh
npm run db:backup
```

Defaults:

- Reads `DATABASE_URL` from `.env` in the repo root
- Writes `backups/sms-<UTC-timestamp>.sql.gz`
- Deletes backups older than 14 days in that directory

Override destination:

```bash
BACKUP_DIR=/var/backups/sms-staging npm run db:backup
```

### Restore (staging only)

```bash
chmod +x scripts/db-restore.sh
npm run db:restore -- backups/sms-20260615T120000Z.sql.gz
```

**Warning:** restore overwrites all data in the target database. Never run against production without a maintenance window and a fresh backup.

### Production backup schedule

Recommended:

- **Daily** full logical backup (`pg_dump`) retained 30 days
- **Weekly** copy to off-site storage (S3 bucket with versioning)
- Test restore on staging **monthly**

Example cron (UTC 02:00 daily):

```cron
0 2 * * * cd /opt/sms && BACKUP_DIR=/var/backups/sms npm run db:backup >> /var/log/sms-backup.log 2>&1
```

## Staging vs production

| Concern | Staging | Production |
|---------|---------|------------|
| `NODE_ENV` | `production` | `production` |
| Email | Real provider to test addresses | Production provider + SPF/DKIM |
| Session cookie | `secure: true` (HTTPS required) | Same |
| DB | Separate instance | Separate instance + backups |
| Seed data | Optional demo seed | Never run `db:seed` with demo passwords |

## Monitoring

- API health: `GET /health`
- Worker: BullMQ queue depth for `notifications`, invoice jobs
- Audit: `/dashboard/audit` for sensitive correction reasons (`attendance.correct`, `payment.verify`, `payment.refund`, `assessment.correct`)

## Related docs

- [Deployment rulebook (release-gate checklists)](../DEPLOYMENT.md)
- [MVP 1 foundation](./mvp-1-foundation.md)
- [MVP 1 demo runbook](./mvp-1-demo-runbook.md)
- [Tenant isolation](./tenant-isolation.md)
