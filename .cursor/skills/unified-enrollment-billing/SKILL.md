---
name: unified-enrollment-billing
description: >-
  Designs and implements the unified enrollment ceremony (preview fees, sibling
  discounts, invoice, optional payment) and prevents the enroll-then-invoice-then-pay
  anti-pattern. Use when working on enrollments, admissions conversion, finance
  invoices, student services, discounts, family groups, or billing preview/confirm flows.
---

# Unified enrollment & billing

## Anti-pattern (verbatim — do not build)

> I have to enroll, I have to generate an invoice, and I have to record payments. Those are just redundant, and I don't want that — this is an anti-pattern for this entire system.

Never ship separate manual steps for standard enrollment billing. One ceremony: **preview → confirm** (optional pay at confirm).

## Read first

- Plan: [docs/unified-enrollment-billing-plan.md](../../docs/unified-enrollment-billing-plan.md)
- Rule: [.cursor/rules/unified-lifecycle.mdc](../../rules/unified-lifecycle.mdc)

## Architecture

| Layer | Responsibility |
|-------|----------------|
| `EnrollmentBillingService` | Preview fee lines, evaluate discounts (sibling), confirm transaction |
| `FinanceService` | AR ops, payment verify, recurring monthly runs, ad-hoc invoices |
| `AdmissionsService` | `start-enrollment` → draft enrollment wizard |
| Enrollment wizard UI | Steps: placement → fee lines → discounts → invoice preview → confirm |

## Confirm transaction must include

1. Enrollment approved + `classroom_students` placement
2. Student `status = enrolled`
3. `student_services` for recurring lines
4. Invoice + items + discount snapshot
5. Optional payment (cash auto-verified)
6. Audit events

## Sibling discount checklist

- [ ] Student has `familyGroupId` (or link guardians into family on create)
- [ ] Count enrolled siblings same `academicYearId`
- [ ] Match `discount_rules` where `discountType = sibling` and `criteria` json matches ordinal
- [ ] Show eligibility in preview UI before confirm

## UI rules

- Remove separate "student services" panel from enrollments list — services are enrollment step 2
- Finance "create invoice" is **ad-hoc only**, not enrollment fees
- Admissions "convert" opens enrollment wizard, not status-only update

## API checklist for new work

- [ ] Zod schema in `@sms/shared`
- [ ] Tenant isolation on every query
- [ ] Audit on confirm/payment/discount apply
- [ ] Matching UI + EN/MY strings
- [ ] Seed data to exercise flow locally
