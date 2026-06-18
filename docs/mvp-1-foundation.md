# MVP 1 Foundation Implementation Plan

## Goal

Prove tenant isolation, authentication, school master data setup, and auditability before any real school is onboarded.

## Implemented Foundation

- Monorepo structure with `web`, `api`, `worker`, and `shared` packages.
- Shared product defaults for the first tenant rollout.
- Shared MVP backlog grouped by release phase.
- Shared roles, permissions, modules, feature flags, and validation schemas.
- NestJS API entrypoint with Swagger docs and health checks.
- Tenant resolver for subdomain, tenant slug, and school code login flows.
- RBAC service for tenant access, permission enforcement, and teacher assignment checks.
- Audit service for sensitive event creation, including attendance corrections.
- Drizzle PostgreSQL schema for core tenant, identity, people, academic, classroom, attendance, LMS, assessment, finance, payroll, communication, and compliance records.
- Next.js dashboard showing product defaults, modules, MVP phases, and RBAC baseline.
- BullMQ worker contracts for invoice generation, email delivery, report card PDFs, and imports.
- Database provider using Drizzle and PostgreSQL.
- Platform tenant endpoints for tenant creation, status changes, settings, and feature flags.
- Tenant identity endpoints for role seeding, user invitations, role assignment, and session records.
- Academic setup endpoints for academic years, terms, grades, sections, subjects, and grade-subject mappings.
- Argon2 password hashing with account activation, login, session issuance, and session revocation.
- Password reset request/confirm flow with token hashing, single-use tokens, and session revocation on reset.
- Permission guard with request tenant-context resolution from assigned roles.
- Platform-admin guard protecting platform tenant routes.
- Identity-manage guard allowing platform admins or tenant `identity.manage` users to provision tenants.
- Audit persistence to `audit_logs` across tenant, identity, auth, and academic workflows, plus an audit viewer endpoint.
- Academic year update and close endpoints with immutability once a year is closed.
- Academic master-data bulk import and export endpoints.
- Drizzle SQL migrations generated from the schema (including password reset tokens).
- Two-tenant isolation seed script.

## MVP 1 Work Breakdown

1. Platform setup
   - Tenant creation, listing, status changes, settings, and feature flag endpoints are implemented.
   - Every setup change records an audit event.
   - Platform routes are protected by the platform-admin guard.

2. Authentication and identity
   - User invitation, role seed/list/assignment, and session record endpoints are implemented.
   - Account activation, Argon2 hashing, login, session issuance/validation, and session revocation are implemented.
   - Password reset request/confirm is implemented with single-use hashed tokens and session revocation on reset.
   - Identity provisioning routes are guarded for platform admins or tenant `identity.manage` users.
   - Sessions are transported via an httpOnly, `SameSite=Lax`, `secure`-in-production cookie validated server-side; the `x-user-id` header is no longer trusted.
   - Password reset tokens are delivered through the notifications channel and never returned in the response body.
   - Sessions enforce a sliding 12h idle timeout plus a 30-day absolute lifetime.

3. RBAC
   - Core tenant role seeding and assignment endpoints are implemented.
   - `PermissionsGuard` resolves tenant context from assigned roles and enforces required permissions.
   - Academics and identity tenant routes are guarded.
   - Teacher assignment scoping is wired for classroom and attendance reads; apply the same pattern to LMS, exam, and grading modules as they land in MVP 3+.

4. Audit logging
   - Audit events are persisted to `audit_logs` for tenant, identity, auth, and academic workflows.
   - An audit viewer endpoint is available to users with `audit.view`.
   - Sensitive corrections (attendance, finance verify/refund, assessment marks) require a non-empty reason via `AuditService.recordSensitiveCorrection`.

5. Academic master data
   - Create/list endpoints for academic years, terms, grades, sections, subjects, and grade-subject mappings are implemented.
   - Academic year update and close endpoints exist, and closed years reject term and grade-subject changes.
   - Bulk import and export endpoints are implemented for first school setup.

6. Operational readiness
   - PostgreSQL migrations are generated via `npm run db:generate`.
   - Two-tenant isolation seed script runs via `npm run db:seed`.
   - Staging template (`.env.staging.example`), backup scripts (`npm run db:backup`), and ops guide (`docs/operations.md`).

## Remaining MVP 1 Work

Verified against the codebase. Grouped by whether the item blocks MVP 1 go-live.

### Blocking

- [x] Secure session transport. Login now sets the session token in an httpOnly, `SameSite=Lax`, `secure`-in-production cookie and no longer returns it in the body. All guards authenticate by validating that cookie's session server-side and ignore the `x-user-id` header; a `logout` endpoint revokes the session and clears the cookie (`apps/api/src/identity/session-cookie.ts`, `auth.controller.ts`, `request-context.service.ts`, the three `*.guard.ts`).
- [x] Teacher-assignment data scoping. `TeacherAssignmentService` resolves staff assignments from `classroom_subject_teachers` and class-teacher links, `@TeacherScoped` runs through `PermissionsGuard`, and classroom/attendance read endpoints filter or reject unassigned teacher access (`apps/api/src/identity/teacher-assignment.service.ts`, `classrooms/`, `attendance/`).
- [x] CI runs migrations. `ci.yml` now sets `DATABASE_URL` and runs `db:migrate` and `db:seed` against the Postgres service before tests (`.github/workflows/ci.yml`).
- [x] Automated tenant-isolation test. `tenant-isolation.test.ts` provisions two tenants and asserts user and settings reads stay scoped per tenant; runs in CI and skips locally when no `DATABASE_URL` is set (`apps/api/src/db/tenant-isolation.test.ts`).

### Hardening (can defer if scoped out)

- [x] Reset-token email delivery. `requestPasswordReset` no longer returns the token; it delivers a reset link through the shared notifications channel (`NotificationsService`: console provider logs locally, BullMQ `notifications` queue otherwise) and always returns `{ requested: true }` to avoid account enumeration. The queue contract now lives in `@sms/shared` (`apps/api/src/notifications/`, `apps/api/src/identity/auth.service.ts`, `packages/shared/src/jobs.ts`).
- [x] Session sliding-timeout policy. Sessions enforce a 12h idle timeout that slides forward on each authenticated request (throttled to one write per minute) and a hard 30-day absolute lifetime from creation. The cookie carries the absolute lifetime while the server enforces both windows in `actorFromSessionToken` (`apps/api/src/identity/session-cookie.ts`, `request-context.service.ts`, `auth.service.ts`).
- [x] Require reasons for sensitive corrections. `recordSensitiveCorrection` enforces non-empty reasons via `@sms/shared` `correctionReasonSchema`. Attendance, finance (verify/refund), and grading (`PATCH .../results/:id`) require reasons; see `apps/api/src/audit/audit.service.ts`.
- [x] Staging/production environment configuration and database backups. Template: `.env.staging.example`; backup/restore scripts: `scripts/db-backup.sh`, `scripts/db-restore.sh`; guide: `docs/operations.md`.

### Exit-criteria sign-off

- [x] Demonstrate the full super-admin to school-admin flow end to end: create tenant, configure modules, configure school profile and academic structure, invite/activate/assign a user, and confirm audit entries. Step-by-step script: `docs/mvp-1-demo-runbook.md`.

## Exit Criteria

- Two demo tenants cannot see each other's users, students, fees, grades, files, or settings.
- A platform super admin can create a tenant and configure subscription/module status.
- A school admin can configure school profile, branding, grades, sections, subjects, and academic year.
- A user can be invited, activated, assigned one or more roles, and scoped to the tenant.
- Sensitive setup changes create audit log entries.
- The web app can display tenant setup state and MVP readiness.
