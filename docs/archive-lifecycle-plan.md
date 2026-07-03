# Archive Lifecycle — System-wide Plan (Proposal)

**Status:** Proposal — not yet built. Awaiting approval.
**Goal (user request):** Every entity should follow one consistent lifecycle: **Active → Archived (reviewable) → Restore _or_ Permanently delete.** Archived data must always be reviewable; users can restore it or delete it entirely.

---

## 1. Current state (as-is)

Archiving today is **ad-hoc and uneven**. There is no shared contract, no unified review surface, and permanent deletion does not exist.

| Area | Archive | Review archived | Restore | Permanent delete |
|---|---|---|---|---|
| **Academics master-data** (years, grades, sections/classrooms, subjects) | ✅ `POST …/archive` | ✅ `MasterDataPanel` shows archived rows + badge | ✅ `POST …/reactivate` | ❌ |
| **Students** | ⚠️ status → `archived` (via profile menu; was mislabeled "delete", now fixed) | ❌ no archived list | ❌ | ❌ |
| **Finance** (invoices, fee structures, discounts) | ⚠️ status flips, partial | ⚠️ partial/inconsistent | ❌ (discounts partial) | ❌ |
| **Salary / Payroll** | ⚠️ status references | ❌ | ❌ | ❌ |
| **Teachers / Staff** | ⚠️ `staffStatusEnum` | ❌ | ❌ | ❌ |
| **Enrollments** | ⚠️ status references | ❌ | ❌ | ❌ |

**Confirmed facts from the codebase:**
- Status enums already carry `archived`: `recordStatusEnum`, `studentStatusEnum`, `staffStatusEnum`, `tenantStatusEnum`, `userStatusEnum` (`apps/api/src/db/schema.ts`).
- **No hard `DELETE` exists in any service** — everything is a soft status flip today. Permanent delete is genuinely missing.
- The **academics module is the proven reference implementation**: `archive` + `reactivate` controller routes (`apps/api/src/academics/academics.controller.ts`) and the web `MasterDataPanel` (`apps/web/app/dashboard/academic-setup/master-data.tsx`) that lists archived rows and offers restore.
- No shared `includeArchived` / `?status=` query convention across list endpoints.
- No audit convention specific to restore/permanent-delete (archive is audited in some modules only).

**Takeaway:** we don't invent from scratch — we **generalize the academics pattern** to every entity and **add the one missing state (permanent delete)**.

---

## 2. Proposed model (to-be)

### 2.1 Three canonical states, one vocabulary
- **Active** — normal, appears in default lists.
- **Archived** — hidden from default lists, excluded from operational queries, **but always reviewable** in an "Archived" filter/view. Reversible.
- **Deleted** — permanent. Irreversible. Guarded.

Burmese labels (already standardized this cycle): Active = **အသုံးပြုဆဲ**, Archive (verb) = **ဖျောက်မည်**, Archived = **ဖျောက်ထားပြီး**, Restore = **ပြန်ယူမည်**, Delete permanently = **အပြီးဖျက်မည်**.

### 2.2 Backend contract (shared)
1. **Soft-archive stays the default.** Archiving flips `status → archived` and stamps `archivedAt` + `archivedBy`. (Add `archivedAt`/`archivedBy` columns where missing; `updatedBy/updatedAt` exist today but don't distinguish archive from edit.)
2. **List endpoints take a `view` param:** `view=active` (default), `view=archived`, `view=all`. Services translate this into the `where` clause consistently. Never leak archived rows into default lists.
3. **Three verbs per archivable entity:**
   - `POST …/{id}/archive` (idempotent; blocks if active dependents — see §2.4)
   - `POST …/{id}/restore` (renamed/aliased from `reactivate`; standardize on **one** verb — recommend `restore`, keep `reactivate` as deprecated alias for academics)
   - `DELETE …/{id}` → **permanent delete**, only permitted when already archived (two-step safety), guarded + audited.
4. **Audit every transition.** `auditService.recordEvent` for archive, restore, and permanent-delete (per CLAUDE.md sensitive-record rule). Permanent-delete records a tombstone (entity type, id, human label, actor, timestamp) so the deletion itself is traceable even though the row is gone.
5. **Tenant isolation preserved** — all three verbs filter by `tenantId` as usual.

### 2.3 Frontend contract (shared)
- A reusable **`ArchivedView` / segmented filter** (Active | Archived | All) on every directory/list, modeled on `MasterDataPanel`.
- Row/detail actions: **Archive** (destructive-tint, confirm), and on archived rows **Restore** + **Delete permanently** (the latter behind a typed/second confirm).
- Consistent iconography: archive → `archive`, restore → `restore`, permanent delete → `delete_forever`.
- All strings via `useTranslations()`, keys in both `en.json` + `my.json`.

### 2.4 Dependency & referential-integrity rules (the hard part)
Permanent delete and even archive must respect relationships:
- **Block or cascade?** Default: **block** permanent-delete when active children/references exist (e.g., a grade with enrolled students, an invoice with recorded payments), returning a clear "what's blocking" payload. Cascade only where semantically safe and explicitly designed.
- **Financial/audit records are special:** invoices, payments, payroll, grades, report cards may be legally retention-bound. Recommend these are **archivable but NOT permanently deletable** by tenant users (only "voided/cancelled" states). Flag for product decision.
- Archiving a parent should surface its dependents (e.g., archiving an academic year → what happens to its sections/enrollments).

---

## 3. Phased build plan

**Progress:** Phase 0 ✅ · Phase 1 (students) ✅ · Phase 2 (academics) ✅ · Phase 3a (teachers/staff) ✅ · Phase 3b (finance/payroll/salary/enrollments) ✅ · Phase 4 (bulk / recycle bin / retention) ✅. **All phases complete.**

**Phase 0 — Foundation (shared primitives)** ✅
- Add `archivedAt`/`archivedBy` columns where missing (migration).
- Create a shared backend helper/mixin for archive/restore/permanent-delete + the `view` query contract.
- Build the reusable web `ArchivedFilter` + actions (generalize `MasterDataPanel`).
- Define the audit + tombstone convention.
- Add i18n keys (restore, deletePermanently, archived-view labels) to both locales.

**Phase 1 — Students** ✅ (highest-visibility gap; user explicitly hit it)
- Add archived list/filter, `restore`, and guarded `permanent-delete` to students.
- Dependency guard: block delete when the student has invoices/payments/enrollment history (recommend archive-only for students with financial history).

**Phase 2 — Academics parity cleanup** ✅
- Renamed `reactivate → restore` for grades/sections/subjects/academic-years (legacy `reactivate` routes kept as deprecated aliases), added guarded permanent-delete for grades/sections/subjects (two-step: archive first; block-on-dependents + FK-violation fallback). Academic years remain lifecycle-only (no hard delete).

**Phase 3 — Finance, Salary, Payroll, Teachers, Enrollments**
- **3a Teachers/staff ✅** — full lifecycle (archivedAt orthogonal to employment status; archive/restore/guarded permanent-delete; Active|Archived|All directory filter; archived badge). Delete blocks on teaching/timetable/salary/payroll, cascades owned compensation config, FK-violation fallback.
- **3b Finance / Salary / Payroll / Enrollments ✅** — archive-only per the split-model decision. Standardized `reactivate → restore` (deprecated aliases kept) for finance fee-items, salary components, payroll pay-components. Reviewed the existing hard-delete routes: all are already appropriately guarded and do **not** hard-delete financial/academic history — `deleteEnrollment` is draft-only (blocks if invoiced/confirmed), `removeStudentService` is a soft-end (`effectiveTo`), `deletePayComponent`/`deleteFeeItem` are two-step (archived-first) + assignment-guarded. No deletes added or removed; invoices/payments/payroll records remain non-deletable, using void/cancel/refund states.
  - Follow-up ✅ — the `discounts` module `reactivate` route was also renamed to `restore` (deprecated alias kept), completing the system-wide verb standardization.

**Phase 4 — Polish** ✅
- **Bulk archive/restore — REMOVED** (product decision 2026-07-02): the row-selection UI, bulk action bar, and students/staff bulk endpoints were built and later removed as unnecessary. Per-row archive/restore/delete via each table's "…" menu is the supported path.
- **Global recycle bin ✅** — `archive` module aggregates archived records across modules; `/dashboard/archive` page with per-row restore + guarded permanent-delete; admin sidebar entry.
- **Retention / auto-purge ✅** — `tenant_settings.archiveRetentionDays` (null/0 = off); a shared purge runner deletes archived students/staff older than the window, skipping any with financial/academic dependents and writing an "auto-purge" audit tombstone; manual `POST archive/purge` trigger + a daily BullMQ repeatable job (03:00) on a new `maintenance` queue.

---

## 4. Product decisions (resolved 2026-07-02)

1. **Delete scope — SPLIT MODEL.** Structural entities (students, teachers/staff, master-data: grades, sections, subjects, academic years) are permanently deletable **with dependency guards**. Financial/academic records (invoices, payments, payroll runs, grades, report cards) are **archive-only** — never hard-deletable by tenant users; use void/cancel/refund states instead.
2. **Restore verb — `restore`.** Standardize on a single `restore` verb everywhere; keep academics' `reactivate` route as a **deprecated alias**.
3. **Permanent delete with active dependents — BLOCK.** Refuse and return the blocking dependents (e.g. "3 sections, 41 students"). No cascade. Targeted cascade may be revisited later only where obviously safe.
4. **Archived review — PER-MODULE FILTERS.** Active | Archived | All toggle on each list (generalize `MasterDataPanel`). Global recycle bin deferred to Phase 4.
5. **Retention / auto-purge — DEFERRED.** Build manual lifecycle first; revisit time-based auto-purge after the model is proven.

---

## 5. Non-goals for this proposal
- Not building anything yet.
- Not changing existing archive behavior until the contract is approved.
- Not deciding legal retention policy — flagged for product/legal.
