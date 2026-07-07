# Phase 2 — P1 automated tests (core product flows)

**Date:** 2026-07-04
**Scope:** localhost-test-plan.md Part B, priority P1
**Result:** ✅ Complete — 4 new suites (+10 API tests, +12 shared tests), full suite green (94 API / 41 shared), no product bugs found

## What was added

| Suite | Tests | Covers |
|---|---|---|
| `enrollments/enrollment-ceremony.spec.ts` | 3 | Preview applies the **sibling discount via family_group_id** (10% off for 2nd enrolled child); `confirm()` atomically creates the invoice + approves the enrollment in one step; double-confirm rejected (409) |
| `finance/recurring-billing.logic.spec.ts` | 2 | Same student + same month → exactly **one** recurring invoice (second call returns the existing one for collection, never a duplicate); a new month bills again |
| `school-profile/school-profile.service.spec.ts` | 5 | Profile round-trip + audit event, clearing optional fields, logo mime/size rejection, re-upload cache-busts `logoFileId`, preferences write across both `tenants` and `tenant_settings` |
| `packages/shared`: `payment-numbers.test.ts`, `school-profile.test.ts` | 12 | Payment/receipt number format, billing-month + payment-plan display helpers, school profile schema edges (empty email ok, bad year rejected), normalize helper, preferences schema |

## Bugs found

None in product code this phase. The enrollment ceremony, recurring duplicate
guard, and school profile behaved exactly as designed under integration
testing — good sign for the two highest-value product rules.

## Facts worth knowing (found while writing tests)

- `ensureRecurringInvoiceForStudent` intentionally returns the **existing**
  invoice id on repeat calls (so Collect can proceed against it) — not null.
- Discount rules use `valueType: "percentage" | "fixed"` (not "percent"),
  and sibling criteria need `{ type: "sibling", appliesTo: { billingContexts: [...] }, minEnrolledSiblings }`.
- Only `tuition` and `registration` fee types are mandatory in the enrollment
  preview (`mandatoryEnrollmentFeeTypes`); other fee items must be selected
  via `optionalFeeItemIds`.
- `enrollments.invoice_id` and `invoices.enrollment_id` reference each other —
  any cleanup/deletion path must break the cycle first.

## Final run

```
npm run typecheck                        → 0 errors
DATABASE_URL=… vitest run (apps/api)     → 94 passed (94)
packages/shared                          → 41 passed (41)
```

## Next

- Phase 3: manual feature pass on localhost (test plan Part C) — human work,
  log as `phase-3-localhost-feature-pass.md`.
- P2 automated (attendance/exams/report cards, UI render tests) can follow
  after Phase 3 based on what it finds.
