# Phase 1 — P0 automated tests (money + irreversible actions)

**Date:** 2026-07-04
**Scope:** localhost-test-plan.md Part B, priority P0
**Result:** ✅ Complete — 4 new suites (24 tests), full API suite green (84 tests), 1 real money bug found & fixed

## What was added

| Suite | Tests | Covers |
|---|---|---|
| `finance/finance.service.spec.ts` | 9 | Oldest-invoice-first collection, partial balances, overpay rejection, non-cash requires reference + pending verification, pending blocks double-collection, distinct receipt numbers, refunds never reopen paid invoices, double-refund rejected |
| `payroll/payroll.service.spec.ts` | 4 | Gross/net composition (base + package − deductions), percent-of-basic deduction math, no duplicate records on regenerate, draft → pending → paid lifecycle, paid records read-only |
| `leaves/leaves.service.spec.ts` | 7 | Quota default, per-year override wins, half-day deduction, overdraw rejected (409), delete returns days, overview totals consistent, archived types excluded |
| `students/students.service.spec.ts` | 4 | Archive/restore round-trip preserves status, delete requires archive first, delete blocked with dependency counts while history exists, clean delete succeeds |

All are DB-backed integration tests (`describe.skipIf(!DATABASE_URL)`), self-cleaning, run in CI automatically.

## Bugs found by this phase

### BUG-P0-1 — percent-of-basic pay components booked as flat amounts in payroll runs (**blocker**, fixed)

- **Found by:** `payroll.service.spec.ts` "generates a run record with correct gross/net composition"
- **Symptom:** a deduction defined as *10% of basic* was booked as **10 MMK flat**
  in generated payroll records, while the record-detail view showed the correct
  30,000 MMK (on a 300,000 base) — pay would have been silently wrong.
- **Root cause:** `PayrollService.getStaffCompensation()` mapped component
  amounts from `defaultAmount` without applying the `percent_of_basic`
  calculation, diverging from `calcComponentAmount()` used elsewhere.
- **Fix:** `apps/api/src/payroll/payroll.service.ts` — amount resolution in
  `getStaffCompensation` now mirrors `calcComponentAmount` (override wins,
  else percent resolves against base salary).
- **Regression guard:** the test that caught it stays in the suite.

## Test-run friction (not product bugs)

- `students.admissionNumber` is required — suites must generate unique ones.
- `payments.verified_by_user_id` / `audit_logs.actor_user_id` are FKs to
  `users` — suites must create a real acting user, not a random UUID.

## Final run

```
npm run typecheck                        → 0 errors
DATABASE_URL=… vitest run (apps/api)     → 84 passed (84)
apps/web                                 → 9 files passed
packages/shared                          → 5 files passed
```

## Next

- Phase 2: P1 tests (enrollment ceremony confirm, school profile, recurring
  billing no-duplicates, shared helpers).
- Phase 3: manual feature pass (test plan Part C) — log results as
  `phase-3-localhost-feature-pass.md`.
