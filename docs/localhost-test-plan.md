# Localhost Test Plan — units & features

The pre-staging testing plan. Everything here runs on a laptop with the local
stack (`npm run db:up`, `npm run db:reset`, `npm run dev`). It has three parts:

- **Part A** — what automated tests exist today (inventory)
- **Part B** — automated tests to add, in priority order (the engineering work)
- **Part C** — the manual feature-test checklist (the human work, module by module)
- **Part D** — definition of done before we deploy staging

Commands:

```bash
npm run typecheck        # compile check, all packages
npm run test             # all automated tests (DB-backed tests need db:up)
npm run db:reset         # fresh demo data before a manual test pass
```

---

## Part A — automated coverage today (29 files)

| Area | Covered by existing tests | Verdict |
|---|---|---|
| **Tenant isolation** | `db/tenant-isolation.test.ts` — cross-school data leakage | ✅ the crown jewel; never skip |
| Identity & access | permissions guard, RBAC, session sliding, response sanitization, teacher assignment | ✅ solid |
| Tenancy | slug resolution | ✅ |
| Enrollment billing | `enrollments/enrollment-billing.service.spec.ts` — fee preview math | ✅ core is covered |
| Timetable | conflicts + service | ✅ |
| Academics, classrooms, audit, HR eligibility | service specs | ✅ basic |
| Shared money helpers | discounts, finance-balance, invoice-numbers, validation, product-decisions | ✅ |
| Web UI primitives | select/options/checkbox/radio/divider/button/data-table | ✅ basic |
| **Finance service** (collect payment, receipts, refunds, invoice lifecycle) | — | ❌ **none** |
| **Payroll** (run generation, component math, payslip) | — | ❌ **none** |
| **Leaves** (balance math, overdraw guard, overview) | — | ❌ **none** |
| Salary/compensation profiles | — | ❌ none |
| Students lifecycle (archive → restore/delete guards) | — | ❌ none |
| Attendance, exams, grading, report cards | — | ❌ none |
| School profile & preferences (new) | — | ❌ none |
| Dashboard/finance overview aggregates | — | ❌ none |

The pattern: **identity and academics are well covered; money is not.** For a
school-fees platform, that's inverted risk — Part B fixes it.

---

## Part B — automated tests to add (priority order)

Rule of thumb: money math and destructive actions first; read-only screens last.

### P0 — must exist before staging (money + irreversible actions)

1. **Finance service** (`finance/finance.service.spec.ts`)
   - collectPayment applies to the oldest open invoice; partial payment leaves
     correct balance; overpayment is rejected
   - refund creates a cash-out line and does **not** reopen the invoice
     (mirrors the gross-based recordable rule)
   - receipt payload: correct school name/currency, sequential receipt numbers
     per tenant (no duplicates under two quick payments)
   - invoice balance = total − verified payments only (unverified excluded)
2. **Payroll** (`payroll/payroll.service.spec.ts`)
   - gross = base + allowances + bonuses; net = gross − deductions
   - percent-of-basic components compute from base salary
   - approve → mark-paid transitions; paid records are read-only
3. **Leaves** (`leaves/leaves.service.spec.ts`)
   - remaining = allocated − used; per-year override wins over type quota
   - recording more days than remaining is rejected (409)
   - deleting a record returns days to balance; overview totals match per-type sums
4. **Students lifecycle** (`students/students.service.spec.ts`)
   - archive → restore round-trip preserves status
   - permanent delete blocked while enrollments/invoices exist (409 with dependencies)

### P1 — should exist before first customer

5. **Enrollment ceremony confirm** — atomic: invoice + enrollment created
   together; optional payment at confirm verified; sibling discount applied
   via `family_group_id`
6. **School profile & preferences** (`school-profile.service.spec.ts`) — upsert
   round-trip, logo mime/size rejection, preferences update both tables,
   audit events recorded
7. **Recurring billing / invoice generation** — no duplicate invoice for the
   same student+period
8. **Shared**: `payment-numbers`, `school-profile` schemas (normalize helper),
   `finance-display`

### P2 — nice to have

9. Attendance correction audit trail; exams/grading approve flow; report-card
   generate/approve; archive auto-purge retention logic
10. Web: RecordFormModal + InputWrapper render tests; leaves roster renders
    remaining/allocated cells from a mocked overview

**Convention** (from CLAUDE.md): colocate as `{module}.service.spec.ts`;
DB-backed tests follow the `apps/api/src/db/*.test.ts` pattern against real
Postgres. Every bug found later in Part C or on staging gets a regression
test here — that's the feedback rule from the playbook.

---

## Part C — manual feature checklist (localhost)

Run after `npm run db:reset`, signed in as `owner@demo-alpha.example.edu.mm`.
Do one full pass in **EN**, then spot-check the same screens in **မြန်မာ**
(no hardcoded English, no clipped Myanmar text). For each line: do it, and
check the *expected result* — including that any create/update/delete of a
sensitive record shows in **Admin → Audit Log**.

### 1. Sign-in & shell
- [ ] Login (wrong password rejected; correct works), sign out, session expiry → redirected to login
- [ ] Sidebar shows school name + logo from School Profile; collapse/expand; mobile drawer (<960px)
- [ ] Cross-tenant spot check: demo-beta owner sees **zero** demo-alpha data

### 2. Settings (Admin)
- [ ] School profile: edit name/type/motto/contact/principal/registration → save → sidebar name updates; logo upload (PNG ok; >2MB and PDF rejected), remove logo
- [ ] Preferences: change language/currency/timezone/date/time formats → save → reload persists
- [ ] School schedule: edit blocks/breaks → periods regenerate
- [ ] User roles & People: invite person (login email sent to console), edit role, disable role blocked while assigned

### 3. Students & People
- [ ] Register student (wizard), edit profile, upload document (5MB cap), link guardian, family group with 2 siblings
- [ ] Transfer, withdraw, archive → restore, archive → delete (blocked when history exists)
- [ ] Guardians & households directories reflect changes

### 4. Admissions → Enrollment (the critical product flow)
- [ ] Enquiry → activities → status advance to offered
- [ ] **Enrollment ceremony**: fee preview shows correct items; sibling discount auto-applies for family with 2 children; invoice preview total = items − discounts; confirm **with** payment → invoice paid + receipt; confirm **without** payment → unpaid invoice appears in Fees & Billing
- [ ] No duplicate/manual invoice path exists anywhere (anti-pattern check)

### 5. Fees & Billing
- [ ] Invoices list: filters, date range, grade drill-down
- [ ] Invoice document: correct school name/logo/address, items, paid-to-date, balance; print; send to guardian
- [ ] Collection: record full payment → settled; partial → correct remaining; receipt prints with school branding and sequential number
- [ ] Payments: pending verification → verify; refund → invoice does not reopen
- [ ] Overview: KPI cards match invoice/payment sums; monthly chart bars visible; no "MMK MMK"
- [ ] Discounts: request (accountant) → approve/reject (owner) with notes; applied discount shows on next preview

### 6. Salary & HR
- [ ] Staff profile page (People → row): info correct; edit saves; Salary & Compensation tab sets base + toggles components
- [ ] Bonuses & benefits: create package (icon, eligibility, textarea styled correctly), incentive program
- [ ] Run payroll: generate month → per-staff breakdown math correct (spot-check one by hand); approve → mark paid (method + reference); payslip modal shows school name/logo; payslip PDF downloads with same numbers
- [ ] Leaves: roster shows all staff remaining/allocated; edit balances (override dot appears); record leave (overdraw rejected; half-day 0.5 works); view/delete records returns days

### 7. Academics & operations
- [ ] Structure: grades/sections/rooms; Academic setup: years/terms/subjects
- [ ] Teachers: profile, teaching setup (subjects/grades/classrooms, conflict override prompts)
- [ ] Timetable: generate periods, assign slot, conflict rejected
- [ ] Attendance: mark class, correction requires reason → audit log
- [ ] Exams/grading/report cards: schedule → enter results → approve → generate report card

### 8. Cross-cutting
- [ ] Audit log captures every sensitive action from this pass, with actor + reason where required
- [ ] Archive lifecycle everywhere: archived records hidden from pickers but restorable
- [ ] Both languages pass; currency/dates honor Preferences on new screens
- [ ] `npm run typecheck && npm run test` green at the end of the pass

---

## Part D — definition of done (gate to staging)

- [ ] All P0 automated tests written and green in CI
- [ ] One full Part C pass completed with zero open **blocker** bugs
  (money-wrong, data-loss, cross-tenant leak = blocker; cosmetic = log it)
- [ ] Every bug found in the pass has either a fix **and** a regression test,
  or a tracked ticket with severity
- [ ] Tenant isolation test still green (always)

When this box-set is checked, we set up staging (Railway) and repeat Part C
there once — it should be boring the second time. That's the point.
