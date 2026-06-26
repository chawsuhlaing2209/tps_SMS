---
name: run-sms
description: Build, launch, and drive the tps_SMS multi-tenant school platform (Next.js web :3000 + NestJS API :4000 + BullMQ worker). Use to run, start, smoke-test, log in to, navigate, or screenshot the running app — e.g. "screenshot the finance invoices page", "run SMS and capture the dashboard", "drive the login flow".
---

# Run tps_SMS

tps_SMS is a monorepo with three processes — `apps/web` (Next.js 15 GUI, port **3000**), `apps/api` (NestJS REST, port **4000**), `apps/worker` (BullMQ) — backed by Postgres/Redis/MinIO. The drivable surface is the **web GUI**; you drive it with `.claude/skills/run-sms/driver.mjs`, a headless-Chrome CDP driver (no Playwright — uses the `ws` already in `node_modules`). The API is driven with `curl`.

**All paths below are relative to the repo root.** The driver lives at `.claude/skills/run-sms/driver.mjs`.

## Prerequisites

- macOS with **Google Chrome** installed at `/Applications/Google Chrome.app` (the driver's default; override with `CHROME=`). On Linux use any Chromium binary via `CHROME=`.
- Node 23 + npm 11 (`node -v` → v23.x). Deps already installed (`node_modules` present); if not: `npm install`.
- Postgres/Redis/MinIO reachable on `:5432 / :6379 / :9000`, and the dev servers running (below).

## Start the stack

Standard start path (from `package.json`). Run from repo root:

```bash
npm run db:up        # docker compose up -d  (postgres + redis + minio)
npm run db:migrate   # apply Drizzle migrations
npm run db:seed      # seed demo tenants (demo-alpha, demo-beta) + demo data
npm run dev          # concurrently starts api, web, worker
```

Confirm it's live before driving (this is the check I run):

```bash
curl -s -o /dev/null -w "web: %{http_code}\n" http://localhost:3000/   # -> web: 200
curl -s http://localhost:4000/health                                   # -> {"status":"ok","service":"sms-api"}
```

## Run — agent path (the driver)

Demo credentials (from the seed): tenant `demo-alpha`, owner `owner@demo-alpha.example.edu.mm`, password `ChangeMe123!`. The driver launches its own headless Chrome, drives the real app, writes a PNG, and cleans up.

```bash
# Screenshot any path WITHOUT logging in (login page, marketing, etc.):
node .claude/skills/run-sms/driver.mjs shot out.png /

# Log in as the tenant owner and screenshot the dashboard:
node .claude/skills/run-sms/driver.mjs login dash.png

# Log in, THEN navigate to a deep page and screenshot it:
node .claude/skills/run-sms/driver.mjs login fin.png /dashboard/finance/invoices
```

Each run prints `landed on /dashboard/...` and `wrote <file>`. **Look at the PNG** — a blank or login page means the flow failed. Verified pages this session: dashboard overview, `/dashboard/finance/invoices` (renders seeded invoices).

Override target/creds via env: `WEB_URL`, `TENANT`, `EMAIL`, `PASSWORD`, `CHROME`.

## Run — API smoke (curl)

Auth is **tenant-scoped**; the URL takes the tenant **slug** as `:tenantId`:

```bash
curl -s -X POST http://localhost:4000/tenants/demo-alpha/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"owner@demo-alpha.example.edu.mm","password":"ChangeMe123!"}'
# -> {"sessionId":"...","userId":"...","tenantId":"...","roles":["school_owner"],"permissions":[...]}
```

## Run — human path

`npm run dev` then open http://localhost:3000 in a real browser and sign in with the demo creds above. Useless headless — use the driver instead.

## Test

```bash
npm run typecheck    # tsc --noEmit across all packages
npm run test         # vitest across all packages
```

## Gotchas

- **`/json/new` is dead on modern Chrome.** Creating a tab via `GET http://localhost:9222/json/new` returns `Using unsafe HTTP verb...` (not JSON) and crashes naive CDP scripts. The driver instead opens the **browser-level** socket (`/json/version`), calls `Target.createTarget`, then `Target.attachToTarget {flatten:true}` and tags every page command with the returned `sessionId`. Do **not** open a second `ws` to the page target — Chrome rejects it with HTTP 500.
- **React-hook-form ignores `el.value = "..."`.** The login inputs are RHF-registered; setting `.value` directly does nothing. You must call the native value setter (`Object.getOwnPropertyDescriptor(proto,'value').set`) and dispatch a bubbling `input` event. The driver's `fillJS` does this; copy it for any other form.
- **Login form selectors:** inputs are `input[name="tenant"]`, `input[name="identifier"]`, `input[type="password"]`; submit is `form.auth-form button[type="submit"]`. If a fill returns `NO_EL:...`, the form markup changed.
- **Redirects need a beat.** Next.js client-side auth redirect to `/dashboard` isn't instant — the driver waits 3.5s after submit and asserts `location.pathname` starts with `/dashboard`. Slow machine → bump the `sleep` in the `login` branch.
- **Infra may be tunneled.** In this environment Postgres/Redis/MinIO were reachable via SSH port-forwards, not local `docker compose`. Running `npm run db:up` then would spin up conflicting local containers on the same ports — check `lsof -iTCP:5432 -sTCP:LISTEN` before assuming you need it.

## Troubleshooting

- `DRIVER ERROR: chrome devtools endpoint never came up` → Chrome path wrong or busy port. Check `CHROME` and that `:9333` is free.
- `field fill failed` / `NO_EL` → login markup changed; re-check the selectors above.
- `login did not reach /dashboard (still at /)` → bad creds, API down, or DB not seeded. Re-run the `curl` API smoke; if that fails, the API/DB is the problem, not the driver.
- Driver hangs → the running web/api stack is down; verify the two health checks above.
