# Phase 3 — localhost feature pass (test plan Part C)

**Date:** 2026-07-04
**Scope:** functional walkthrough of Part C on a fresh `db:reset`, driven via the real API + headless browser. Human-judgment items are listed at the bottom for a follow-up review pass.
**Result:** ✅ Functional pass complete — 0 blockers, 0 major, 2 minor observations

## What was exercised (and the observed result)

### 1. Sign-in & shell
- Wrong password → 401 ✅ · correct login → session ✅
- **Cross-tenant isolation**: demo-beta session requesting demo-alpha students and invoices → 401 both times; alpha sees its own data ✅
- Sidebar shows school name + uploaded logo from the profile ✅

### 2. Settings
- School profile PUT→GET round-trip (name/type/motto/contact/principal/registration/year) ✅
- Preferences round-trip (language/currency/timezone/date/time) ✅
- Logo: 3 MB upload → 413, PDF → 400, small PNG → accepted with new `logoFileId` ✅

### 3. Students
- Document upload over 5 MB → 413 ✅
- Archive → `archivedAt` set; restore → cleared ✅ · delete without archive → 400 ✅

### 4. Enrollment ceremony (on live demo data)
- Preview loads the fee plan (550,000 subtotal for the draft student) ✅
- Create enrollment → confirm → **invoice `INV-04072026-4BL` created atomically**, source `enrollment`, school name "Aung Myint Myat Private School" on the document ✅
- Double confirm → 409 "Enrollment is already confirmed." ✅
- Sibling-discount preview not reachable on seeded data (the two draft students have no enrolled sibling) — the scenario is covered by the Phase 2 integration test; consider adding a draft-sibling family to the seed for future manual passes.

### 5. Fees & Billing
- Partial cash 200,000 → invoice `partial`; settle 350,000 → `paid` ✅
- Two receipts issued with distinct numbers (`PKR-04072026-QT2`, `-X62`) using the tenant's receipt prefix ✅
- Over-collection attempt after settle → rejected ("no open invoice") ✅
- Finance overview chart shows this month's 550,000 collected; single "MMK" unit ✅

### 6. Salary & HR
- Seeded payroll run present, 17 records; record detail carries school name; net math present ✅
- Leaves roster: 17 rows = 17 active staff ✅

### 7. Academics
- Timetable periods present (9) ✅ · exam cycles and calendar events return empty lists (no seed data — endpoints healthy)

### 8. Audit log
- All of today's sensitive actions present: `enrollment.confirm`, `payment.collect`, `tenant.school_profile.update`, `tenant.preferences.update`, `student.archive` ✅

### Languages
- Myanmar spot check (finance overview, settings, leaves seen earlier): full chrome translated, layout intact, no clipping ✅

## Findings

| # | Severity | Finding | Action |
|---|---|---|---|
| F3-1 | minor | Bar-chart month axis labels (FEB…JUL) stay English in the Myanmar view | Backlog: localize month labels via `Intl.DateTimeFormat` with the active locale |
| F3-2 | minor | Demo seed has no draft student with an enrolled sibling, and no exam cycles / calendar events — some manual scenarios can't be walked without extra setup | Backlog: extend `seed-demo-alpha` for richer manual-testing coverage |

## Deferred to human review (needs your eyes, not a robot's)

- [ ] Copy & tone pass in both languages (labels, help texts, empty states)
- [ ] Printed documents visual quality: invoice, receipt, payslip PDF
- [ ] Student registration wizard + teacher teaching-setup UX walkthrough
- [ ] The Part C checkboxes marked judgment-y: "does it feel right?"

## Verdict against the gate (test plan Part D)

- P0 + P1 automated: ✅ green in CI
- Functional Part C pass: ✅ zero open blockers
- **Remaining before staging:** the human review items above — then the gate is fully cleared.
