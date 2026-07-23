# DEPLOYMENT.md — tps_SMS Deployment Rulebook

The **enforceable gate** for every release. Whenever a feature is deployed,
a migration ships, a tenant is onboarded, or infrastructure changes, run the
matching checklist here — no exceptions, no from-memory shortcuts.

Companions (read those for the *why* and the *how-to*; this doc is the *gate*):
- [docs/staging-to-production-playbook.md](docs/staging-to-production-playbook.md) — plain-language environments/release guide
- [docs/operations.md](docs/operations.md) — host setup, backups, monitoring
- [docs/mvp-scope-matrix.md](docs/mvp-scope-matrix.md) — what is allowed to appear in MVP-1

---

## 1. Architecture invariants (never violate)

These decisions are settled. Changing any of them requires an explicit,
recorded decision — not a convenient workaround in a feature branch.

| # | Invariant | Meaning |
|---|-----------|---------|
| I1 | **One codebase, one deployment, all tenants** | Never fork per client, never per-tenant branches, never a separate deployed copy per school. Tenant differences are **data** (feature flags, settings), never code. |
| I2 | **Pool model: shared Postgres, shared schema, `tenant_id` everywhere** | Every tenant-owned table carries `tenant_id`; every query filters by it. No per-tenant databases/schemas at this stage. |
| I3 | **Tenant identity comes from the session, never the request** | Guards resolve `TenantContext` from the httpOnly cookie. `tenantId` from a request body/query is untrusted display data only. |
| I4 | **Database-level isolation backstop (RLS)** | Postgres Row-Level Security on all tenant-owned tables, with transaction-scoped `set_config('app.tenant_id', …, true)` and a non-owner app role. App-layer scoping (I2) stays mandatory — RLS is the net under it, not a replacement. *(Status: *planned* — flip to *live* when the RLS migration lands, then this row becomes enforced by the isolation test.)* |
| I5 | **Migrations are additive; deploys never touch data** | Expand-then-contract. Never `DROP`/rename a column in the release that stops using it. `db:seed`/`db:reset`/`db:restore` never run against production. |
| I6 | **`main` is always releasable; production runs a tag** | Trunk-based: feature branch → PR → green CI → merge. Staging tracks `main`; production deploys tagged releases (`vMAJOR.MINOR.PATCH`). |
| I7 | **Secrets live only in the host's secret manager** | Nothing real in git. Each environment has its own `SESSION_SECRET`, DB credentials, S3 keys. |
| I8 | **Per-tenant file storage namespace** | Object storage keys are always `tenants/{tenantId}/…`. |
| I9 | **Feature launch ≠ code deploy** | Risky/new features ship to production behind a `feature_flags` row, off by default; flipping the flag per tenant is the launch. |

---

## 2. Checklist A — every feature release (run before merging to `main`)

Copy this list into the PR (or verify each line) for **every** feature/fix
that will reach tenants.

### Correctness & safety
- [ ] `npm run typecheck` and `npm run test` green — **including**
      `apps/api/src/db/tenant-isolation.test.ts` (never skipped, never marked flaky).
- [ ] Every new/changed service method that touches tenant-owned tables takes
      `tenantId` and filters by it in **every** where clause (I2).
- [ ] No endpoint trusts `tenantId` (or any authorization input) from the
      request body (I3).
- [ ] Create/update/delete on sensitive records (student, finance, discounts,
      salary, identity, corrections) calls `auditService.recordEvent(...)`.
- [ ] New permissions added to `packages/shared/src/roles.ts` — both the
      `Permission` union **and** the role mapping(s) — and guarded with
      `@RequirePermissions(...)` on the controller.

### Migrations (if the schema changed)
- [ ] Migration is **additive** (nullable columns / defaults / new tables).
      Any destructive step is deferred to a later release (I5).
- [ ] New `apps/api/drizzle/meta/_journal.json` entry has a `when` value
      **higher than the previous entry** (journal uses normalized values
      > 1783900000000) — otherwise `db:migrate` silently skips it.
- [ ] Migration rehearsed on staging (against a restored production backup
      once production exists) before the release tag.

### Product parity
- [ ] All user-facing strings via `useTranslations()`, keys present in **both**
      `messages/en.json` and `messages/my.json` (a one-sided key =
      runtime `MISSING_MESSAGE`).
- [ ] Feature checked against [docs/mvp-scope-matrix.md](docs/mvp-scope-matrix.md) —
      no MVP-2 surfaces leaking into MVP-1.
- [ ] UI follows the Padauk system (`DESIGN.md`, `docs/COMPONENTS.md`): reused
      components, `--pds-*` tokens, no hardcoded hex, list pages keep
      row-click detail navigation + URL-persisted filters.
- [ ] Data respects the active academic year / archived-record scoping
      (no archived grades/years leaking into pickers, tabs, or counts).

### Rollout decision
- [ ] Decide and record in the PR: does this ship **flagged** (I9) or
      unconditionally? New modules and risky changes default to flagged,
      off for all tenants, on for the internal/demo tenant first.
- [ ] If flagged: flag key added to `packages/shared/src/modules.ts` and the
      per-tenant default documented.

---

## 3. Checklist B — every production deploy (release ritual)

Full narrative version: [playbook §4](docs/staging-to-production-playbook.md).

**Before (on staging):**
- [ ] Release content verified on staging in **both EN and Burmese**, including
      printed documents (invoice, receipt, payslip) if finance/payroll changed.
- [ ] Migration rehearsal done (Checklist A).

**Release day:**
- [ ] `npm run db:backup` — verify the backup file exists and is non-zero.
- [ ] Tag: `git tag vX.Y.Z && git push origin vX.Y.Z`; deploy **that tag**.
- [ ] Order is fixed: `db:migrate` completes **before** new API/worker/web start.
- [ ] Smoke test (≤5 min): `GET /health`, login, dashboard, open an invoice,
      record a test payment on the internal tenant, check worker queue depth.
- [ ] Watch ~30 minutes: error tracker, logs, worker queues.

**Rollback:**
- Code problem → redeploy the previous tag (safe because migrations are additive).
- Data problem → restore the pre-deploy backup in a maintenance window
  (this means an invariant was broken — write down which and why).

---

## 4. Checklist C — onboarding a new tenant (school)

One school = one runbook pass. Never hand-craft rows in the production DB.

- [ ] Provision the tenant via the platform-admin flow/script: slug, school
      name, locale, timezone, currency/date preferences.
- [ ] Default roles + permissions created; first academic year created.
- [ ] Feature flags set: MVP-1 modules on, everything else off (I9).
- [ ] School-owner account created with a strong one-time password +
      forced change on first login. **No demo/seed credentials, ever.**
- [ ] Object storage prefix confirmed: `tenants/{tenantId}/…` (I8).
- [ ] Verify isolation live: log in as the new tenant, confirm zero data from
      other tenants anywhere (directory counts, finance totals, exports).
- [ ] Record the tenant in the ops log: slug, tenant UUID, go-live date,
      enabled flags, primary contact.

---

## 5. Security invariants & hardening status

The "never" list is absolute (see [playbook §8](docs/staging-to-production-playbook.md)):
no seeds/resets/restores against production, no hand-edits of prod data, no
secrets in git, no untagged production deploys, no force-push to `main`.

Track hardening as a living table — a row is only *done* when verified in the
deployed environment, not on a laptop:

| Item | Status |
|------|--------|
| httpOnly + `secure` + `sameSite` session cookie | done (verify `secure` flips on in prod) |
| CORS locked to real web origin (`API_ALLOWED_ORIGINS`) | pending prod config |
| Postgres RLS backstop + non-owner app DB role (I4) | planned |
| Rate limiting on `/auth/login` (+ `helmet` on API) | planned |
| HTTPS-only + HSTS at the edge | pending hosting |
| Managed daily backups + PITR + **one completed restore drill** | pending hosting |
| Error tracking (Sentry) + uptime monitor on `/health` | planned |
| Platform-admin endpoints restricted (strong creds, optional IP allowlist) | planned |

Update this table in the same PR that changes an item's status.

---

## 6. Infrastructure reference

One production topology, mirrored by staging with its own isolated data stores.

| Piece | Staging | Production |
|-------|---------|------------|
| API / Web / Worker | same code, deployed from `main` | same code, deployed from release tag |
| PostgreSQL 16+ | own instance, demo data | managed instance, backups + PITR |
| Redis | own instance | managed instance |
| Object storage | own bucket | S3-compatible managed bucket (Cloudflare R2 or equivalent; MinIO is dev-only) |
| Email | real provider → test addresses | real provider + SPF/DKIM |
| Domain/TLS | `staging.<domain>` behind HTTPS | `app.<domain>` behind HTTPS/CDN |

### Decision log

Record infrastructure decisions here as they're made, with date and reason.

| Date | Decision | Choice | Why |
|------|----------|--------|-----|
| 2026-07-23 | Tenancy model | Pool (shared DB + `tenant_id`) + planned RLS backstop | Industry default for B2B SaaS at this scale; lowest ops for a solo operator |
| 2026-07-23 | Repo model | Single repo, trunk-based, tags for prod | One codebase for all tenants (I1/I6) |
| — | Hosting platform | *TBD (Railway / Render / VPS)* | |
| — | Production domain | *TBD* | |

---

## 7. Scaling path (future — revisit at the thresholds, not before)

Do **not** pre-build any of this. Each row names the trigger that justifies it.

| Trigger | Then consider |
|---------|---------------|
| Slow list pages / DB CPU pressure | Read the query plans first; add composite indexes with `tenant_id` leading. |
| Tens of schools, heavy report queries | Read replica for reporting/exports. |
| A tenant demands data residency / contractual isolation | Promote *that tenant* to its own database (the pool model + `tenant_id` columns make per-tenant extraction straightforward); keep the shared pool for everyone else. |
| Worker backlog grows | Scale worker instances horizontally; split queues by job type (`packages/shared/src/jobs.ts` already discriminates). |
| Multi-region users | CDN for web assets first; regional DB only if latency is proven to hurt. |

The order of operations when scale hurts: **measure → index → cache → replica
→ shard**. Never jump a step.

---

## 8. Keeping this document honest

- When a *planned* item ships (RLS, rate limiting, hosting), update §5/§6 in
  the same PR.
- When a release ritual step fails or gets skipped, add what was learned to
  the relevant checklist — checklists grow from incidents.
- If a checklist item is repeatedly ignored, either enforce it in CI or
  delete it. A checklist people skip is worse than no checklist.
