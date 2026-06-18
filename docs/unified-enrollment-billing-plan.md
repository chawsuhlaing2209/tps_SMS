# Unified Enrollment & Billing Plan

> **Product principle:** Enrollment is a single ceremony — not three separate chores.  
> The anti-pattern to avoid: *enroll → generate invoice → record payment* as disconnected manual steps.

## 1. Executive summary

Today the SMS has working CRUD for admissions, enrollments, student services, fee plans, invoices, payments, and discounts — but they **do not orchestrate**. Staff must:

1. Create an enrollment record
2. Separately add student services
3. Manually create an invoice in Finance
4. Separately record a payment on the invoice detail page

This is redundant, error-prone, and hides business rules (sibling discounts, grade fee plans, family billing) from the person doing enrollment.

**Target:** One **Enrollment ceremony** that shows placement + fee lines + discount preview + invoice preview, then on confirm atomically:

- Places the student in the classroom
- Persists chosen services for recurring billing
- Creates the invoice with correct discounts
- Optionally records payment (same transaction)

Finance remains the **AR operations hub** (collections, verification, monthly runs, reports) — not a duplicate enrollment path.

---

## 2. Current state (as-built)

### 2.1 What exists

| Domain | Schema | API | UI |
|--------|--------|-----|-----|
| Admissions | `enquiries`, `lead_activities` | CRUD + convert (status only) | List, detail, convert button |
| Enrollments | `enrollments` | CRUD + approve | Table + create sheet |
| Student services | `student_services` | CRUD (soft delete) | Second panel on enrollments page |
| Fee catalog | `fee_items`, `enrollment_fee_plans` | Finance CRUD | Finance sub-pages |
| Invoices | `invoices`, `invoice_items` | Manual create; monthly gen **stub** | List, detail, record payment |
| Discounts | `discount_rules`, `student_discounts` | Request/approve workflow | Finance → discounts page |
| Students | `students`, `classroom_students`, `family_groups` | Lifecycle enroll (classroom only) | Profile enroll/transfer/withdraw |

### 2.2 Critical gaps

1. **Dual enrollment model** — `enrollments` table vs `students/:id/enroll` → `classroom_students`. They never sync.
2. **Admissions pipeline broken** — `convertEnquiry` only sets enquiry status; `enrollments.enquiryId` never set.
3. **Fee plans disconnected** — `enrollment_fee_plans` not used when billing.
4. **Discounts disconnected** — `createInvoice` hardcodes `discountTotal: "0"`; no sibling logic.
5. **No invoice ↔ enrollment link** — cannot trace why an invoice exists.
6. **Payment during enrollment impossible** — UI has no combined flow.
7. **Student services siloed** — separate panel instead of part of enrollment lines.
8. **Family billing unused** — `students.familyGroupId`, `invoices.familyGroupId` exist per product decision but empty.

### 2.3 Anti-pattern (do not build)

```
❌ Staff enrolls student on Enrollments page
❌ Staff adds transport on Student Services panel
❌ Staff opens Finance → Invoices → Create (re-typing line items)
❌ Staff opens invoice detail → Record payment
```

Each step loses context from the previous one. Discounts and sibling rules are invisible until too late.

---

## 3. Target experience (high level)

### 3.1 Single enrollment ceremony (primary UX)

**Entry points** (all land in the same wizard):

- Enrollments → New enrollment
- Student profile → Enroll for year
- Admissions enquiry → Convert & enroll (after offered)
- Dashboard setup checklist → Enroll student

**Wizard steps (one sheet or stepped flow):**

| Step | Content |
|------|---------|
| 1. Student & placement | Student (or create from enquiry), academic year, grade, classroom |
| 2. Fee lines | Auto-loaded from `enrollment_fee_plans` for year+grade; toggles for optional services (transport, boarding, etc.) from `fee_items` |
| 3. Discounts | System-evaluated eligibility + manual overrides; sibling banner; approved `student_discounts` |
| 4. Invoice preview | Read-only breakdown: subtotal, each discount, total, due date |
| 5. Confirm | Options: *Save draft*, *Confirm enrollment*, *Confirm & mark paid* |

**After confirm:**

- Enrollment status → `approved` / `published`
- `classroom_students` row created (replaces separate student enroll API for this path)
- Student status → `enrolled`
- `student_services` rows for recurring fee lines
- Invoice created and linked to enrollment
- If "mark paid": payment + receipt stub + invoice status updated

### 3.2 Finance tab role (secondary UX)

Finance becomes **operations**, not **origin**:

- View/search all invoices & payments (including those created at enrollment)
- Verify non-cash payments
- Cancel invoices (with reason)
- Monthly recurring invoice generation (from active `student_services`)
- Receivables, collection reports, dashboard stats
- Discount rule administration (stays here or moves to Settings — not duplicated)

**Remove or hide:** manual "create invoice" for enrollment fees when enrollment ceremony exists. Keep manual invoice only for ad-hoc charges (damage, late fee, etc.) — clearly labeled "Other charge".

### 3.3 Admissions integration

```
Enquiry (offered) → Convert & Enroll wizard
  ├─ Pre-fill: prospective name, guardian, target grade
  ├─ Create student + guardians + family group (if new)
  └─ Continue into enrollment ceremony (steps 1–5)
```

`enrollments.enquiryId` set. Enquiry status → `enrolled` only when enrollment confirms.

### 3.4 Salary & finance together (MVP 5 scope)

Salary is **not** part of the enrollment ceremony but shares the **Finance business area**:

- Finance overview dashboard: revenue (verified payments) + outstanding AR + **salary outflow** (approved/paid salary records)
- Shared audit trail and period reporting (monthly report already partially exists)
- No enrollment → salary coupling except through consolidated financial reports

Staff salary does not affect student fee calculation in v1.

---

## 4. Business logic (low level)

### 4.1 Enrollment fee line construction

**Inputs:** `tenantId`, `academicYearId`, `gradeId`, optional selected optional fee item IDs

**Algorithm:**

1. Load all `enrollment_fee_plans` for `(year, grade)` → mandatory lines (tuition, registration, etc.)
2. Load optional `fee_items` where `feeType` in configured optional types (transport, boarding, meals, …) not already in mandatory set
3. For each line: `{ feeItemId, description, unitAmount, quantity: 1, source: 'fee_plan' | 'optional' }`
4. Store as **preview** only until confirm

**Overrides (v1):** none — amounts come from plans. v2: principal override with audit reason.

### 4.2 Discount evaluation engine

New service: `BillingPreviewService` (or `EnrollmentBillingService`) — single source for preview and confirm.

**Discount sources (priority order):**

1. **Approved student discounts** — `student_discounts` where `status = approved`, effective date range includes enrollment date, linked `discount_rules`
2. **Automatic rule matching** — rules where `discountType` matches criteria:
   - `sibling` — see §4.3
   - `early_payment` — if paying at enrollment (confirm + pay)
   - `staff_child` — future; needs staff link on student/guardian
3. **Manual request at enrollment** — creates `student_discount` in `submitted` status; blocks confirm until approved OR user removes discount

**Application math:**

- `valueType = percentage` → line or subtotal reduction per rule config
- `valueType = fixed` → subtract fixed amount (cap at line/subtotal)
- `approvalThreshold` — if discount amount exceeds threshold, require `discount.approve` permission to apply at confirm

**Output:** `{ eligibleDiscounts[], appliedDiscounts[], discountTotal, warnings[] }`

Persist on confirm: snapshot on invoice (`discountTotal`) + optional `invoice_discount_lines` table for audit.

### 4.3 Sibling discount logic

**Prerequisites:**

- Students linked via `family_group_id` (same guardian household)
- Sibling rule in `discount_rules` with `discountType = 'sibling'`

**Detection at preview time:**

1. Resolve student's `familyGroupId` (from student record or guardians being linked in same ceremony)
2. Query siblings: other `students` with same `familyGroupId`, `status = enrolled`, with an **approved enrollment** for the same `academicYearId`
3. Compute sibling order (e.g. by `dateOfBirth` or existing enrollment date) — **document chosen rule in tenant settings**
4. Match rule criteria (schema extension needed):

```typescript
// discount_rules.criteria jsonb (proposed)
{
  "type": "sibling",
  "minEnrolledSiblings": 1,      // discount applies to 2nd child onward
  "siblingOrdinal": 2,           // optional: exactly 2nd child
  "appliesToFeeTypes": ["tuition"]
}
```

**UI:** Show banner — *"Sibling discount eligible: {rule.name} (−10%) — 1 enrolled sibling in this family"* or *"No sibling discount — no other enrolled students in family group"*.

**Edge cases:**

- New family (first child): no sibling discount
- Twin enrollments same day: define ordinal tie-breaker
- Withdrawn sibling: exclude if enrollment not active for year

### 4.4 Invoice generation on confirm

**Transactional boundary** (all or nothing):

```
BEGIN
  upsert enrollment (status approved)
  insert classroom_students
  update students.status = enrolled
  insert student_services (recurring lines only — billingType != one_time)
  insert invoice + invoice_items
  apply discount snapshot
  IF collectPayment:
    insert payment (cash → auto-verified)
    update invoice.status (paid | partial)
    insert receipt row (optional v1 stub)
  set enrollments.invoiceId
  audit events
COMMIT
```

**Invoice fields:**

- `studentId`, `familyGroupId` (from student)
- `issueDate` = today, `dueDate` from tenant default or ceremony input
- Line items from enrollment fee lines
- `discountTotal`, `total = subtotal - discountTotal`
- Link: `enrollments.invoiceId` (new FK)

**Idempotency:** Confirm on already-confirmed enrollment → 409 Conflict.

### 4.5 Payment at enrollment

When user selects **Confirm & mark paid**:

- Payment method from enum (`cash`, `bank_transfer`, `kbzpay`, …) — fix UI mismatch with schema
- Amount defaults to invoice `total`; allow partial with warning
- Cash: auto-verify (existing finance logic)
- Non-cash: create unverified payment; invoice stays `unpaid`/`partial` until verified in Finance

### 4.6 Recurring billing (post-enrollment)

Monthly/term billing **separate ceremony** — runs via worker:

- Input: `academicYearId`, `billingMonth`
- For each active `student_services` + enrolled student → generate invoice from fee item amount
- Re-run discount engine for that billing period
- Does not replace enrollment invoice; adds recurring invoices

---

## 5. Data model changes

### 5.1 New / modified tables

| Change | Purpose |
|--------|---------|
| `enrollments.invoiceId` | FK → invoices (nullable until confirm) |
| `enrollments.confirmedAt` | Timestamp |
| `enrollments.billingSnapshot` | jsonb — frozen preview at confirm (audit) |
| `enrollment_fee_lines` | Draft lines before confirm (or jsonb on enrollment) |
| `invoices.enrollmentId` | FK → enrollments (reverse link) |
| `invoice_discounts` | Applied discount breakdown per invoice |
| `discount_rules.criteria` | jsonb — sibling ordinal, fee types, thresholds |
| `family_groups` usage | Wire on student create / enquiry convert |

### 5.2 Deprecate (conceptually, not drop tables)

- Separate **Student Services panel** on enrollments page → merged into enrollment wizard step 2
- `POST /students/:id/enroll` for new enrollments → redirect to enrollment ceremony API; keep transfer/withdraw on student API

### 5.3 Shared Zod schemas (`@sms/shared`)

Add to `validation.ts`:

- `enrollmentPreviewSchema`
- `enrollmentConfirmSchema` (includes `collectPayment?`, `payment?`)
- `discountCriteriaSchema`
- `enrollmentFeeLineSchema`

API DTOs and web forms import from shared — single validation source.

---

## 6. API design

### 6.1 New enrollment billing endpoints

Base: `tenants/:tenantId/enrollments`

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| POST | `/preview` | `student.manage` | Build fee lines + discount preview (no writes) |
| POST | `/` | `student.manage` | Create draft enrollment + optional inline preview |
| GET | `/:id` | `student.manage` | Enrollment + lines + linked invoice summary |
| POST | `/:id/preview` | `student.manage` | Re-preview after line toggles |
| POST | `/:id/confirm` | `student.manage` + maybe `finance.manage` for pay | Atomic confirm |
| PATCH | `/:id` | `student.manage` | Draft updates only |

### 6.2 Admissions extension

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/admissions/enquiries/:id/start-enrollment` | Create draft student (if needed) + draft enrollment; return enrollmentId for wizard |

Replace meaningless `convert` with this, or make `convert` call it.

### 6.3 Finance adjustments

| Change | Description |
|--------|-------------|
| `POST /finance/invoices` | Restrict to `ad_hoc` type; reject if duplicate enrollment invoice |
| `EnrollmentBillingService` | Called from enrollments confirm — not duplicated in finance controller |
| `GET /finance/students/:id/summary` | Invoices, balance, discounts for student profile tab |

### 6.4 Module wiring

```
EnrollmentsModule imports FinanceModule (BillingPreviewService)
AdmissionsModule imports EnrollmentsModule
FinanceModule exports BillingPreviewService, InvoiceService
```

Avoid circular imports via shared `BillingModule` if needed.

---

## 7. UI plan

### 7.1 Replace enrollments page

**One list** with columns: Student, Year, Grade, Classroom, Status, Invoice (link), Total, Paid?

**One action:** New enrollment → multi-step sheet (or route `/dashboard/enrollments/new`)

Remove second "Student services" panel — services are step 2 checkboxes.

### 7.2 Student profile additions

Tab: **Enrollment & billing** — enrollments for student, invoices, active services, discounts.

### 7.3 Admissions detail

Replace "Convert" with **Start enrollment** → navigates to wizard with query `?enquiryId=`.

### 7.4 Finance simplification

- Invoices list: filter `source: enrollment | recurring | ad_hoc`
- Hide generic create form behind "Other charge" action
- Fix payment method select to match API enum

### 7.5 i18n

All wizard strings in `enrollments.*` and `finance.*` — EN + MY.

---

## 8. Implementation phases

### Phase A — Foundation (1–2 weeks)

- [ ] Schema migration: `enrollments.invoiceId`, `invoices.enrollmentId`, `discount_rules.criteria`
- [ ] Unify enrollment: confirm writes `classroom_students`; deprecate duplicate student enroll for new cases
- [ ] Shared Zod schemas
- [ ] Seed demo data: fee plans, sample enrollment end-to-end

### Phase B — Preview engine (1–2 weeks)

- [ ] `BillingPreviewService`: fee lines from plans + optional items
- [ ] `POST /enrollments/preview` API
- [ ] Enrollment wizard steps 1–4 (UI only preview, no confirm)

### Phase C — Discount & sibling (1 week)

- [ ] Family group resolution on student/guardian link
- [ ] Sibling detection query
- [ ] Discount application math + approval threshold gate
- [ ] Step 3 UI with eligibility banners

### Phase D — Confirm transaction (1–2 weeks)

- [ ] `POST /enrollments/:id/confirm` atomic flow
- [ ] Optional payment at confirm
- [ ] Step 5 confirm buttons
- [ ] Finance list shows enrollment-sourced invoices

### Phase E — Admissions pipeline (1 week)

- [x] `start-enrollment` from enquiry
- [x] Pre-filled wizard
- [x] Enquiry status sync on confirm

### Phase F — Finance consolidation (1 week)

- [x] Remove redundant manual enrollment invoice UX (Other charge only for ad-hoc)
- [x] Student billing tab (`GET /finance/students/:id/summary`)
- [x] Payment method enum aligned with `@sms/shared`
- [x] Reports include enrollment vs recurring vs ad_hoc breakdown

### Phase G — Recurring billing (follow-up)

- [x] Worker: `generate-monthly-invoices` real implementation
- [x] Reuse `EnrollmentBillingService.previewRecurring` for recurring fee lines + discounts

---

## 9. Testing & acceptance criteria

| Scenario | Expected |
|----------|----------|
| Enroll with grade fee plan | Preview shows correct tuition from plan |
| Second sibling same year | Sibling discount appears in preview |
| Confirm without pay | Invoice unpaid; student enrolled; classroom placed |
| Confirm with cash pay | Invoice paid; payment visible in Finance |
| Enquiry → enroll | Student created; enquiry enrolled; one invoice |
| Approve discount over threshold | Blocked until approver confirms |
| Monthly run | New invoice for transport service; no duplicate tuition if one_time already billed |

---

## 10. Permissions

| Action | Permission |
|--------|------------|
| Preview / draft enrollment | `student.manage` |
| Confirm enrollment | `student.manage` |
| Apply large discount at confirm | `discount.approve` |
| Record payment at confirm | `finance.manage` |
| Verify bank payment later | `finance.manage` |

---

## 11. References

- Product decision: `financeInvoiceScope: per_student_invoices_with_family_balance_grouping`
- MVP backlog: `mvp2-admissions-student-lifecycle`, `mvp5-finance-communication`
- Anti-pattern rule: `.cursor/rules/unified-lifecycle.mdc`
- Agent skill: `.cursor/skills/unified-enrollment-billing/SKILL.md`
