# tps_SMS — System Architecture & Code Review

**Date:** 2026-06-19  
**Branch:** `claude/bold-cori-cjzd3w`  
**Scope:** Full-stack: NestJS API · Next.js 15 web · BullMQ worker · PostgreSQL schema · shared package  
**Methodology:** Static analysis via source inspection. No live system, no load tests, no query plans.

---

## 1. Executive Summary

tps_SMS is a competent, disciplined multi-tenant SaaS with a strong design system, strict TypeScript, solid authentication, and an excellent unified enrollment+billing ceremony. The codebase is production-intent but has a cluster of **infrastructure gaps that must close before a multi-tenant go-live** — most critically: no database indexes on `tenant_id`, a missing NestJS module wire, no rate limiting on auth, and ~33 % of the Burmese UI still untranslated.

### Maturity Ratings (1 = critical gaps · 5 = production-ready)

| Dimension | Rating | Verdict |
|---|---|---|
| System Health | 3 / 5 | Missing module wire, no env validation, worker stubs |
| Security | 3.5 / 5 | Excellent authn; gaps in rate-limit, CSRF, headers, exception filter |
| Scalability | 2 / 5 | **No indexes on any tenant table — biggest single risk** |
| Performance | 3 / 5 | No pagination on ~85 % of list tables; no code-splitting |
| User Experience | 4 / 5 | Excellent state patterns; dead responsive rules, touch targets |
| LESP | 2 / 5 | Hard deletes on financial records; 33 % Burmese untranslated; no consent model |

### Most Urgent Action Per Dimension

| Dimension | Single Most Urgent Action |
|---|---|
| Health | Wire `NotificationsModule` into `AppModule` — currently crashes DI graph |
| Security | Add `helmet` + `@nestjs/throttler` on auth routes + global exception filter |
| Scalability | Add composite indexes `(tenant_id, <filter_col>)` on all high-traffic tables |
| Performance | Add DB-level pagination to all 50+ unpaginated list endpoints |
| UX | Fix 7 silently-dead `@media var()` queries + raise touch targets to 44px |
| LESP | Translate `my.json` (start with `discounts`, `finance`, `students` namespaces) |

---

## 2. Findings Table

| ID | Dim | Sev | Title | Location |
|---|---|---|---|---|
| **SC1** | Scalability | Critical | No `tenant_id` index on any high-traffic table | `schema.ts:99-100`, all entity tables |
| **SE1** | Security | High | No `helmet`, no rate limiting on auth routes | `main.ts:1-24` |
| **SE2** | Security | High | No CSRF protection (cookie sessions, `sameSite: lax`) | `session-cookie.ts:47-54` |
| **SE3** | Security | High | No global exception filter — internal errors may leak | `app.module.ts` |
| **SH1** | Health | High | `NotificationsModule` missing from `AppModule.imports` | `app.module.ts:28-59` |
| **SC2** | Scalability | High | No FK from `tenant_id` → `tenants` on entity tables | `schema.ts:99-100` |
| **SC3** | Scalability | High | N+1 on payments list (`getRefundedTotalForPayment` per row) | `finance.service.ts:1157-1161` |
| **P1** | Performance | High | `DataTable` renders all rows — no pagination on ~50 list pages | `app/lib/data-table.tsx:243-372` |
| **SE4** | Security | High | No frontend security headers / CSP | `next.config.ts` (no `headers()`) |
| **L1** | LESP | High | Hard deletes on student/financial records — unrecoverable | `schema.ts` (whole) |
| **L2** | LESP | High | 33 % of `my.json` is untranslated English (647 / 1969 keys) | `messages/my.json` |
| **SE5** | Security | Medium | Platform admin can mint sessions for any tenant's user | `identity-manage.guard.ts:37-47`, `identity.controller.ts:68` |
| **SE6** | Security | Medium | 3 endpoints silently unguarded (no `@Public()` pattern exists) | `tenancy.controller.ts:8`, `app.controller.ts:14` |
| **SE7** | Security | Medium | `bulkMarkRecords` inserts attendance without verifying session ownership | `attendance.service.ts:98-114` |
| **SE8** | Security | Medium | id-only UPDATE/DELETE in finance & enrollment (no `tenantId` in WHERE) | `finance.service.ts:1346`, `enrollment-billing.service.ts:460,740` |
| **SH2** | Health | Medium | No startup env validation — missing vars fail at runtime, not boot | `app.module.ts:30-35` |
| **SH3** | Health | Medium | Worker has no retry/backoff, no dead-letter queue; jobs spawn `npx tsx` | `worker/src/index.ts:14-37` |
| **SC4** | Scalability | Medium | DB pool has no `max` / timeout config (defaults to 10 connections) | `db.module.ts:17-19` |
| **P2** | Performance | Medium | No code-splitting on heavy workspaces (timetable, enrollment, invoices) | `timetable-workspace.tsx`, `enrollment-wizard.tsx` |
| **UX1** | UX | Medium | No skeletons — loading state is plain muted text | `app/lib/table-panel.tsx:120-128` |
| **UX2** | UX | Medium | Timetable workspace has no loading or error UI | `timetable-workspace.tsx:342,470` |
| **UX3** | UX | Medium | Touch targets 32–36px (WCAG min is 44px) | `app/globals.css:1161,1192,1205` |
| **UX4** | UX | Medium | 7 `@media` rules use `var()` — silently dead, responsive collapse never fires | `app/globals.css:2531,2536,2545,3589,3594,4024,5343` |
| **H1** | Health | High | No React error boundaries — render error crashes route with no recovery | no `error.tsx` / `global-error.tsx` |
| **L3** | LESP | Medium | Student PII (`medicalNotes`, `identityNumber`) stored as plain text, no field-level encryption | `schema.ts:408-409` |
| **L4** | LESP | Medium | No consent, lawful-basis, or data-subject fields in schema | `schema.ts:397-421` |
| **SH4** | Health | Low | `/health` returns static payload — no DB/Redis readiness check | `app.controller.ts:6-7` |
| **SE9** | Security | Low | `SESSION_SECRET` declared in `.env.example` but never used in code | `.env.example:18` |
| **SE10** | Security | Low | `attendance.service.ts:239` uses `sql.raw` string concatenation | `attendance.service.ts:239` |
| **L5** | LESP | Low | Audit log rows not append-only — no DB trigger/constraint prevents tampering | `schema.ts:267` |
| **UX5** | UX | Low | 6 hardcoded English `aria-label`s bypassing i18n | `record-breadcrumbs.tsx:9`, `secondary-side-nav.tsx:65` |
| **A1** | UX | Medium | Icon-only buttons missing `aria-label` | `hero-more-actions.tsx`, `attendance-toggle.tsx` |
| **H2** | Health | Medium | Test coverage covers only 7 PDS primitive files — no page/flow tests | `vitest.config.ts` |
| **⊕** | Security | Positive | argon2id + 256-bit token hashing; enumeration-safe password reset | `password.service.ts`, `auth.service.ts` |
| **⊕** | Security | Positive | No `tenantId` trusted from request body — always from path param via guard | all controllers |
| **⊕** | Security | Positive | No secrets in client bundle; same-origin API proxy; no `dangerouslySetInnerHTML` | `next.config.ts`, `app/lib/api.ts` |
| **⊕** | Health | Positive | `strict: true` + `noUncheckedIndexedAccess: true` across all packages | `tsconfig.base.json` |
| **⊕** | UX | Positive | Centralized loading/error/empty state pattern (17 / 18 data pages correct) | `app/lib/table-panel.tsx` |
| **⊕** | UX | Positive | Enrollment wizard is exemplary: Zod, Stepper, sibling discount preview, atomic confirm | `enrollment-wizard.tsx` |
| **⊕** | Health | Positive | 49-component PDS registry + 44 Storybook stories | `components/pds/registry.ts` |
| **⊕** | LESP | Positive | Sensitive corrections require mandatory reason; sibling rules rule-driven | `audit.service.ts:35-47` |

---

## 3. Dimension Deep-Dives

### 3.1 System Health — Rating 3/5

**Module wiring (Critical):** `NotificationsModule` is defined and consumed by `AuthService` (`auth.service.ts:10,33`) but is absent from `AppModule.imports` (`app.module.ts:28-59`). Notification routes are unreachable at runtime and the DI graph may fail to resolve `NotificationsService` depending on provider leakage from other modules. This should be wired or explicitly removed before deploy.

**Environment validation:** `ConfigModule` has no `validationSchema`. Only `DATABASE_URL` is guarded with `getOrThrow` (`db.module.ts:18`). `REDIS_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `EMAIL_PROVIDER` are all consumed silently — a misconfigured deployment fails at runtime (or silently falls back), not at boot. Add a Zod or Joi validation schema to `ConfigModule`.

**Worker reliability:** The BullMQ worker (`worker/src/index.ts`) has no `concurrency` setting, no `attempts`/`backoff` retry policy, and no dead-letter queue. More critically, the invoice generation job shells out to `npx tsx generate-monthly-invoices.ts` as a child process per invocation — expensive, not containerization-friendly, and impossible to observe. The other three job types are stubs that only `console.log`. The worker needs to be promoted to first-class before background billing runs reliably.

**Observability:** Structured logging is absent (only `console.log` in the worker and NestJS default logger in the API). No OpenTelemetry, no correlation IDs, no request-scoped logging. The `/health` endpoint returns `{ status: "ok" }` unconditionally — it is not a real probe.

**Positives:** TypeScript `strict` + `noUncheckedIndexedAccess` across all packages. The audit service is well-designed: logins, logouts, activations, password resets, session revocations, and a dedicated sensitive-correction path with a mandatory reason string.

---

### 3.2 Security — Rating 3.5/5

**Authentication (strong):** Password hashing with argon2id, session tokens are 256-bit random values stored as sha256 hashes (never the raw token). Login uses a generic "Invalid credentials" message (no account enumeration). Password reset revokes all existing sessions. This is a genuinely robust authn foundation.

**Missing hardening layer:**
- No `helmet` — no `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, or `X-XSS-Protection` on API responses.
- No `@nestjs/throttler` — auth routes (`/auth/login`, `/auth/password-reset/request`, `/auth/activate`) are brute-forceable with no consequence.
- No global exception filter — unhandled exceptions may return Nest's default response which can include stack traces in development mode bleed-through.
- No CSRF tokens — the session cookie is `sameSite: "lax"` which mitigates cross-site form POST but does not protect subdomain or same-site vectors.
- No CSP on the frontend — `next.config.ts` has no `headers()` export.

**Tenant isolation (mostly solid, two gaps):** Application-layer `eq(table.tenantId, tenantId)` is consistently applied on list queries. Two categories need hardening:
1. `bulkMarkRecords` in `attendance.service.ts:98-114` inserts attendance rows using a `sessionId` from the DTO without first verifying the session belongs to the current tenant. A malicious admin from tenant A can insert attendance against a session ID from tenant B.
2. Several `UPDATE`/`DELETE` operations key on record id alone without a `tenantId` guard in the WHERE clause (`finance.service.ts:1346`, `enrollment-billing.service.ts:460,740`, `enrollments.service.ts:350`). These are currently safe only because the id is obtained from a prior tenant-scoped SELECT in the same request — one refactor away from a cross-tenant mutation.

**Platform admin surface:** `IdentityManageGuard` (`identity-manage.guard.ts:37-47`) short-circuits to allow any platform admin on any tenant's identity routes, including `POST tenants/:tenantId/identity/sessions` — effectively allowing a platform admin to mint a valid session as any user in any tenant. This should be rate-limited and audit-logged with extra scrutiny, or restricted to a dedicated internal endpoint.

**Silent public routes:** There is no `@Public()` decorator in the codebase. "No guard = public" is the implicit rule. Three endpoints are silently unguarded: `GET tenancy/resolve`, `GET app/foundation`, and `GET health`. Document this explicitly and add a lint rule or audit sweep.

---

### 3.3 Scalability — Rating 2/5

**Database indexes — the most critical gap:** Of 67 tables in `schema.ts`, only approximately 5 declare any index. The shared `tenantFields` helper (`schema.ts:99-100`) defines `tenant_id` with no index and no foreign key reference to the `tenants` table. This means **every tenant-scoped query** — which is every query in the system — performs a full sequential scan. At demo scale (hundreds of records) this is invisible. At production scale (10 tenants × 1000 students × 3 years of invoices and attendance records) it degrades catastrophically and one large tenant starves all others.

Minimum required indexes:
```sql
-- On every entity table:
CREATE INDEX ON students (tenant_id, status);
CREATE INDEX ON invoices (tenant_id, status, due_date);
CREATE INDEX ON payments (tenant_id, created_at);
CREATE INDEX ON attendance_records (tenant_id, session_id, date);
CREATE INDEX ON enrollments (tenant_id, academic_year_id, status);
-- Plus FK indexes on all foreign key columns
```

**N+1 pattern:** `finance.service.ts:1157-1161` maps over a paginated payments array and calls `getRefundedTotalForPayment` (a separate aggregate query) for each row inside `Promise.all`. Replace with a single `GROUP BY refunded_payment_id` subquery joined to the main result.

**No FK constraint:** Without a FK from `tenant_id` → `tenants`, the database provides no referential guarantee. A bug or race condition can produce orphan rows that are invisible to any tenant's queries but accumulate indefinitely.

**Session store:** Sessions are stored in Postgres (not in-memory) — the API is horizontally scalable for auth. No module-level mutable state found. DB pool lacks `max`/timeout tuning (defaults to 10 connections per instance).

**Worker:** The monthly invoice job spawns `npx tsx` as a child process. Under load this creates OS process overhead proportional to job concurrency and prevents the runtime from controlling parallelism. The job processor should be an in-process handler with BullMQ `concurrency` set.

---

### 3.4 Performance — Rating 3/5

**Frontend pagination gap:** `DataTable` (`app/lib/data-table.tsx`) passes its entire `data[]` prop through TanStack Table's `getSortedRowModel` with no `getPaginationRowModel`. DB-level pagination (limit/offset + `PaginationControls`) exists in only 8 of ~58 list surfaces: invoices, payments, audit log, dashboard, households, students directory, guardians directory, and discounts requests. The remaining ~50 lists (teachers, enrollments, academics, salary, timetable, exams, report cards, calendar, etc.) load entire tenant tables into memory and ship them to the client. The invoices workspace (`invoices-workspace.tsx:59-72`) is the correct model to replicate.

**No code-splitting:** There is no `next/dynamic` anywhere in the codebase. Heavy workspaces — `timetable-workspace.tsx` (676 lines), `enrollment-wizard.tsx` (270+ lines), `invoices-workspace.tsx` — ship in the initial route bundle regardless of whether the user navigates to those routes. These should be dynamically imported.

**Server component opportunity:** Every `page.tsx` is `'use client'`. All data flows through TanStack Query on the client. This is a valid architecture but forgoes the ability to server-render any data — the user receives a blank shell until hydration + fetch complete. Adding `loading.tsx` / `error.tsx` files to route segments would improve perceived performance and provide safety nets.

**Fonts and images:** Font loading is handled correctly with `next/font/google` and `display: "swap"`. No unoptimized `<img>` tags found. Material Symbols is loaded via a remote `<link>` with `preconnect` — acceptable but self-hosting would improve offline resilience.

---

### 3.5 User Experience — Rating 4/5

**Loading / error / empty (strong):** The centralized `TablePanelBody` + `EmptyState` pattern gives consistent three-state handling (loading text → error message → empty illustration → data) across 17 of 18 sampled data pages. `useApiMutation` automatically surfaces errors as toasts (`api.ts:171-175`). This is the codebase's most mature pattern.

**Enrollment wizard (exemplary):** The unified enrollment+billing ceremony in `enrollment-wizard.tsx` correctly implements the product's core flow: 4-step `Stepper`, Zod `zodResolver` with field-level errors, per-step preview mutations, sibling discount detection (auto-surfaced from `family_group_id`), draft save/resume, `role="alert"` error region, busy-state button disabling, and atomic confirm with optional payment. This is exactly what the product requires.

**Dead responsive breakpoints:** Seven `@media` rules in `globals.css` use `var(--pds-breakpoint-*)` in the media condition (e.g., `@media (max-width: var(--pds-breakpoint-lg))`). CSS `@media` conditions cannot contain `var()` references — they silently evaluate to `false`. The responsive layout changes those rules implement (sidebar collapse, table scroll, column stacking) **never fire**. All breakpoints must be replaced with literal pixel values (`960px`, `720px`, `640px`).

**Touch targets:** All interactive elements — `.btn-primary`, `.btn-ghost`, `.pds-btn` variants — have heights between 32px and 36px. WCAG 2.5.5 requires a minimum of 44×44px for touch targets. This affects every teacher and parent on mobile.

**Missing states:** The timetable workspace (`timetable-workspace.tsx:342,470`) renders the grade navigation and room grid directly from query data with no loading spinner and no error UI. A slow or failed fetch produces a blank grid with no feedback.

**Accessibility gaps:** Several icon-only buttons (`hero-more-actions.tsx`, `select.tsx`, `attendance-toggle.tsx`) lack `aria-label`. The attendance toggle conveys state via icon and color only, with no text alternative. Six `aria-label` strings are hardcoded in English rather than routed through `t()`.

---

### 3.6 LESP — Rating 2/5

**Legal:**
- **Hard deletes are a legal and financial risk.** No table has `deleted_at` / `is_deleted` columns. Deletion endpoints issue hard `DELETE` statements. For student records, financial transactions (invoices, payments, refunds), and audit events, this conflicts with standard financial record retention requirements and makes accidental deletion unrecoverable. Minimum mitigation: soft-delete `students`, `enrollments`, `invoices`, `payments`.
- The audit log table has no append-only constraint or database trigger — rows can be mutated by anyone with DB credentials. Consider a write-once trigger or an external audit sink.
- No invoice/receipt legal field audit has been done against Myanmar commercial record requirements (e.g., mandatory fields for formal receipts).

**Ethical / Privacy:**
- The schema collects `medical_notes`, `identity_number` (national ID), `photo_file_id`, `address`, `township`, and `date_of_birth` on students, plus `phone`/`email`/`address` on guardians. There are no consent fields, no lawful-basis fields, no data-subject preference flags, and no data retention or deletion policy mechanism in the schema.
- `medical_notes` and `identity_number` are stored as plain `text`. These are sensitive special-category fields that warrant field-level encryption at rest.
- Discount/scholarship logic is rule-driven (sibling rules via `family_group_id`) and covered by a unit test (`discounts.test.ts`) — the fairness and consistency of the algorithm is auditable, which is a positive.

**Social / Language Equity:**
- **33% of `my.json` strings are byte-identical English** (647 of 1969 leaf values). The worst namespaces are `discounts` (161 untranslated), `finance` (68), `students` (58), `academics` (52), `settings` (50). Key count parity is perfect (no missing keys) so all that is required is translation. For a Myanmar-first product sold to Myanmar schools, this is the most consequential user-facing gap.
- The responsive breakpoint bug (UX4 above) disproportionately affects mobile users — the demographic most likely to include teachers and parents in Myanmar's connectivity context.

**Professional:**
- TypeScript strict mode, PDS registry with Figma mapping, and Storybook coverage are professional-grade.
- Test coverage is thin: 7 test files, all covering PDS primitives. No tests for the enrollment/billing ceremony, finance service business logic, or tenant isolation at the application layer. The tenant isolation test (`apps/api/src/db/tenant-isolation.test.ts`) file exists but its coverage was not verified.
- No CI/CD pipeline was found in the repository.

---

## 4. Prioritized Action Plan

### Immediate — fix before multi-tenant go-live

1. **[SC1] Add `tenant_id` indexes** — Generate a Drizzle migration adding composite indexes `(tenant_id, status)`, `(tenant_id, created_at)`, etc. on `students`, `invoices`, `payments`, `attendance_records`, `enrollments`, `audit_events`. Single biggest scalability win.
2. **[SH1] Wire `NotificationsModule`** into `AppModule.imports` — one-line fix, unknown runtime impact without it.
3. **[SE1] Add `helmet` + `@nestjs/throttler`** — install both, configure throttle on `POST /auth/login`, `POST /auth/password-reset/request`, `POST /auth/activate`.
4. **[SE3] Add global exception filter** — catch all unhandled exceptions, return a structured `{ error, message }` envelope, log internally, never expose stack traces.
5. **[SE7] Fix `bulkMarkRecords` tenant check** — verify the DTO `sessionId` belongs to `tenantId` before inserting attendance rows.
6. **[H1] Add `app/dashboard/error.tsx` + `app/global-error.tsx`** — prevents uncaught render errors from crashing the route with no recovery UI.
7. **[UX4] Fix dead `@media` breakpoints** — replace all 7 `var(--pds-breakpoint-*)` in media conditions with literal px values.

### Next sprint

8. **[P1] Add pagination to all unpaginated list endpoints** — follow the invoices workspace pattern: `limit`/`offset` query params in service, `PaginationControls` component in page.
9. **[SE2] Add CSRF protection** — `csurf` or the double-submit cookie pattern for all state-changing routes.
10. **[SE4] Add `headers()` to `next.config.ts`** — CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Strict-Transport-Security`.
11. **[SE8] Add `tenantId` to id-only mutations** — add `eq(table.tenantId, tenantId)` to UPDATE/DELETE in `finance.service.ts:1346`, `enrollment-billing.service.ts:460,740`, `enrollments.service.ts:350`.
12. **[SH2] Add env validation** — Zod schema on `ConfigModule` to fast-fail on missing `REDIS_URL`, `S3_*`, `EMAIL_*`.
13. **[SH3] Harden the worker** — in-process job handlers, `concurrency: 4`, `attempts: 3` with exponential backoff, dead-letter queue.
14. **[SC3] Fix N+1 on payments** — replace per-row `getRefundedTotalForPayment` with a grouped subquery.
15. **[P2] Code-split heavy workspaces** — `next/dynamic` for `timetable-workspace`, `enrollment-wizard`, `invoices-workspace`.
16. **[UX3] Raise touch targets** — bump `.btn-primary`, `.btn-ghost`, `.pds-btn` min-height to 44px.
17. **[L2] Translate `my.json`** — start with `discounts`, `finance`, `students` (227 keys combined).
18. **[UX1] Add skeleton loading states** — replace `c("loading")` text with skeleton row components in `TablePanelBody`.

### Backlog

19. **[L1] Soft-delete** — add `deleted_at` to `students`, `invoices`, `payments`, `enrollments`; change delete endpoints to set the flag.
20. **[L3] Encrypt sensitive fields** — field-level encryption for `medical_notes` and `identity_number`.
21. **[L4] Add consent model** — `consent_at`, `consent_by`, `lawful_basis` fields on `students`.
22. **[SC2] Add FK `tenant_id → tenants`** — referential integrity at the DB layer.
23. **[SC4] Tune DB pool** — set `max: 20`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000`.
24. **[SH4] Real `/health` probe** — check DB connectivity and Redis ping, return degraded/unhealthy status.
25. **[H2] Expand test coverage** — unit tests for `finance.service.ts`, `enrollment-billing.service.ts`, `discount.service.ts`; integration tests for the enrollment ceremony end-to-end.
26. **[A1] Add `aria-label` to icon-only buttons** — `hero-more-actions.tsx`, `attendance-toggle.tsx`, `select.tsx`.
27. **[L5] Audit log immutability** — DB trigger or external append-only log to prevent tampering.
28. **[UX2] Timetable loading/error states** — add query state handling to grade nav and room grid.
29. **[SE9] Remove dead `SESSION_SECRET`** from `.env.example` or actually use it.
30. **[SE6] Document public route convention** — add a `@Public()` decorator + enforce that all unguarded routes are explicitly opted-in.

### Preserve

- argon2id authentication + session token architecture
- Tenant isolation via path-param guard + consistent service filtering
- `tenantId`-from-path (never from body) convention
- Enrollment wizard UX (the unified ceremony is correctly implemented)
- Centralized loading/error/empty state pattern via `TablePanelBody`
- PDS component registry + Storybook coverage
- Same-origin API proxy (no client-side secrets, no CORS exposure)
- Strict TypeScript across all packages
- Sensitive correction mandatory-reason enforcement

---

## 5. Architecture Diagram (as-found)

```
Browser (Next.js 15 — all pages 'use client')
    │ TanStack Query → apiFetch()
    ▼
Next.js API rewrite proxy (/api/* → :4000)
    │ httpOnly session cookie
    ▼
NestJS API (:4000)
    ├── SessionGuard → RequestContextService (resolves tenant + user from session)
    ├── PermissionsGuard → @RequirePermissions() per route
    ├── IdentityManageGuard (special: platform admin cross-tenant)
    ├── Controllers → Services → Drizzle ORM
    │       └── PostgreSQL (shared schema, tenant_id filter per query — NO RLS, NO tenant FK indexes)
    ├── AuditService (event log, sensitive corrections)
    └── [NotificationsModule — NOT WIRED]

BullMQ Worker (:separate process)
    ├── Redis queue (REDIS_URL)
    └── Job handlers [mostly stubs; invoice job spawns npx tsx subprocess]

MinIO / S3 (file storage)
    └── Path pattern: tenants/{tenantId}/... [correct]
```

**Gaps vs intended design:**
- DB has no RLS and no `tenant_id` indexes — isolation is single-layer (app code only)
- `NotificationsModule` not wired — notification flows are non-functional
- Worker is not production-grade — no retry, no DLQ, subprocess model
- No CI/CD pipeline found
- No CSP / security headers on either API or frontend
- ~50 list pages fetch entire tables with no DB pagination

---

## 6. Limitations

The following could not be assessed without a running system:

- Actual query execution plans and sequential-scan impact at real data volumes
- Whether `NotificationsModule`'s DI resolution fails at runtime or succeeds via provider leakage
- Real CSRF exploitability (depends on deployed cookie domain and subdomain configuration)
- Bundle sizes (no build output analyzed)
- Color contrast ratios (numerical WCAG AA check requires rendering)
- Screen-reader behavior (requires assistive technology)
- BullMQ producer-side retry options (only worker-side confirmed to lack config)
- Whether the `tenant-isolation.test.ts` integration test actually passes against a live database
