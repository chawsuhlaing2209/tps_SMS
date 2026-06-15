# /dev — Start Dev Stack

Starts the full development environment for tps_SMS.

## Steps

1. Ensure Docker services are running (postgres, redis, minio):
```bash
npm run db:up
```

2. Wait a moment for services to be healthy, then start all app services:
```bash
npm run dev
```

This runs `apps/api` (port 4000), `apps/web` (port 3000), and `apps/worker` concurrently.

## URLs

- Web UI: http://localhost:3000
- API + Swagger: http://localhost:4000/docs
- MinIO console: http://localhost:9001 (user: minio / minio-password)

## Demo accounts (after db:seed)

- Platform admin: http://localhost:3000/platform/login
  - Email: platform-admin@example.edu.mm / Password: ChangeMe123!
- School admin (tenant: demo-alpha): http://localhost:3000/
  - Email: owner@demo-alpha.example.edu.mm / Password: ChangeMe123!
- Teacher (scoped): teacher@demo-alpha.example.edu.mm / ChangeMe123!

## Troubleshooting

If API fails to start with DB error: `npm run db:migrate` then retry.
If types are broken after pulling: `npm run build` to rebuild shared package first.
