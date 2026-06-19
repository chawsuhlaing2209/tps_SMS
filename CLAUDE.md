# tps_SMS — Claude Code Guide

Multi-tenant school management system for Myanmar schools (SaaS). One shared PostgreSQL database, strict tenant isolation via `tenant_id` on every tenant-owned table.

## Monorepo Layout

```
apps/api/       NestJS REST API (port 4000)
apps/web/       Next.js 15 App Router UI (port 3000)
apps/worker/    BullMQ background job worker
packages/shared TypeScript-only: roles, permissions, Zod schemas, job types
```

## Unified enrollment & billing (critical product rule)

**Anti-pattern:** separate flows to enroll → manually create invoice → manually record payment. That is redundant; do not build or preserve it.

**Required pattern:** one enrollment ceremony with fee preview, discount evaluation (including sibling rules via `family_group_id`), invoice preview, and atomic confirm (optional payment at confirm). Finance is for AR operations and recurring billing — not re-entering enrollment fees.

See `docs/unified-enrollment-billing-plan.md` and `.cursor/rules/unified-lifecycle.mdc`.

## Key Conventions

### Backend (NestJS + Drizzle)

**Every new domain module needs:**
1. `{module}.module.ts` — NestJS module wiring
2. `{module}.controller.ts` — REST routes, guards, permission decorators
3. `{module}.service.ts` — business logic, always filters by `tenantId`
4. `dto.ts` — Zod-backed class-validator DTOs

**Tenant isolation rule:** Every service method that queries tenant-owned data must accept `tenantId` as a parameter and include it in every `where` clause. Never query without it.

**Permission guard pattern:**
```typescript
@UseGuards(PermissionsGuard)
@RequirePermissions('student.manage')
@Get()
list(@Param('tenantId') tenantId: string, ...) {}
```

**Audit logging requirement:** All create/update/delete on sensitive records must call `auditService.recordEvent(...)`. Sensitive = student, finance, attendance corrections, grades, discounts, salary, report cards, identity.

**Adding to AppModule:** Import your new module in `apps/api/src/app.module.ts`.

**Route pattern:** All tenant-scoped routes start with `tenants/:tenantId/`.

### Frontend (Next.js + Tailwind + shadcn/ui)

**Data fetching:**
```typescript
// Read
const { data, isLoading } = useApiQuery<Student[]>(tid => `/tenants/${tid}/students`)

// Write
const mutation = useApiMutation<CreateStudentDto, Student>(
  (body, tid) => ({ path: `/tenants/${tid}/students`, init: { method: 'POST', body: JSON.stringify(body) } }),
  { invalidatePaths: (_, tid) => [`/tenants/${tid}/students`] }
)
```

**i18n requirement:** All user-facing strings must use `useTranslations()` from `next-intl`. Never hardcode English strings in JSX. Add keys to both `messages/en.json` and `messages/my.json`.

**Component structure:**
```
apps/web/app/lib/              Padauk UI wrappers (Panel, DataTable, DetailHero, RecordList, …)
apps/web/app/dashboard/        Shell layout, PageHeader context, in-body chrome, sidebar
apps/web/components/ui/        shadcn/ui primitives (Dialog, Sheet, Button, Table shell)
apps/web/components/shared/    ConfirmDialog, AppToast, CheckboxList
apps/web/app/globals.css       Padauk component classes (.panel, .padauk-table, .btn-primary, …)
```

**Page layout:** Publish title/breadcrumbs/actions with `PageHeader` from `app/dashboard/page-header-context.tsx`; the layout renders `DashboardPageChrome` (breadcrumb + utilities) and `DashboardPageTitle`. Page body uses `.page-stack` → optional `DetailCard` → `.panel` sections.

**Form pattern:** `react-hook-form` + Zod via `zodResolver` from `app/lib/zod-resolver.ts`. Validate with shared Zod schemas from `@sms/shared`. Create/edit flows use `RecordFormSheet` (shadcn Sheet, 480px).

### Shared Package (`@sms/shared`)

- `roles.ts` — roles, permissions, role→permission mapping (single source of truth)
- `jobs.ts` — BullMQ job type discriminated union
- `validation.ts` — Zod schemas shared between API and web
- `modules.ts` — feature flags and product modules

When adding a permission: edit `packages/shared/src/roles.ts`, add to the Permission union AND the relevant role mapping(s).

## Dev Commands

```bash
npm run dev          # all services concurrently
npm run dev:api      # API only
npm run dev:web      # web only
npm run dev:worker   # worker only
npm run db:up        # start postgres + redis + minio
npm run db:generate  # drizzle-kit generate (after schema change)
npm run db:migrate   # apply pending migrations
npm run db:seed      # seed demo tenants
npm run db:reset     # drop + recreate + migrate + seed
npm run tokens:build # regenerate design-tokens.css after token changes
npm run typecheck    # tsc --noEmit across all packages
npm run test         # vitest across all packages
npm run build        # production build all packages
```

## Environment

Copy `.env.example` to `.env`. Required vars:
- `DATABASE_URL` — postgres://sms:sms@localhost:5432/sms
- `REDIS_URL` — redis://localhost:6379
- `SESSION_SECRET` — long random string
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `EMAIL_PROVIDER=console` (dev) or SES/Resend config (prod)

## Multi-Tenant Isolation Rules

1. Every query on a tenant-owned table MUST include `eq(table.tenantId, tenantId)` in where clause.
2. Guards resolve `TenantContext` from session cookie — never trust `tenantId` from body.
3. File storage paths must be `tenants/{tenantId}/...`.
4. Audit logs are written per-tenant.
5. Platform admin endpoints live under `/platform/...` and use `PlatformAdminGuard`.

## Design System

See `DESIGN.md` for the full visual language (**Padauk School OS** — ink-green shell + spring-lime CTAs).

**Token pipeline:** edit `tokens.json` (Figma export) and/or `composite_tokens.json` → `npm run tokens:build` → `apps/web/app/design-tokens.css` (generated). Component classes live in `apps/web/app/globals.css`. `apps/web/tailwind.config.ts` mirrors the same CSS variables for utilities. Never hardcode hex in components.

**UI conventions:**
- Wise-inspired: 1px borders, restrained color, trustworthy finance UX
- Adaline-inspired: dense `.padauk-table`, compact sidebar, keyboard-navigable rows
- Reuse Padauk patterns: `.panel` + `PanelHead`, `TablePanelHead`/`TablePanelBody`, `TableSearchInput`, `.badge badge--*`, `.btn-primary` / `.btn-ghost`
- shadcn/ui for overlays (Dialog, Sheet) — match Padauk sizing when mixing
- Icons: `<Icon name="…" />` (Material Symbols Rounded)
- Content max width 1180px, left-aligned under `.dash-content`

## Testing

- Unit tests colocated: `{module}.service.spec.ts`
- Integration tests in `apps/api/src/db/` against real PostgreSQL
- Tenant isolation test: `apps/api/src/db/tenant-isolation.test.ts`
- Run before every commit: `npm run typecheck && npm run test`
