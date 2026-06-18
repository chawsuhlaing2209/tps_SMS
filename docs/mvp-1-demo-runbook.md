# MVP 1 demo runbook

End-to-end sign-off script: **platform super admin → new tenant → school setup → invite user → audit trail**.

Estimated time: 30–45 minutes.

## Prerequisites

```bash
colima start          # or Docker Desktop
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000

## Demo credentials (from seed)

| Role | URL | Tenant / identifier | Password |
|------|-----|---------------------|----------|
| Platform super admin | `/platform/login` | `platform-admin@example.edu.mm` | `ChangeMe123!` |
| Demo school owner | `/` | Tenant `demo-alpha`, owner email from seed console output | `ChangeMe123!` |

After `db:seed`, the API logs owner emails for each demo tenant.

---

## Part A — Platform admin creates a tenant

1. Go to **http://localhost:3000/platform/login**
2. Sign in as platform admin.
3. Open **Tenants** (`/platform/tenants`).
4. Create a new tenant, for example:
   - Name: `Gamma International School`
   - Slug: `demo-gamma`
   - Owner name / email: your test address
5. Confirm the tenant appears in the list with status **active**.
6. Note the owner welcome email in the API console (dev uses `EMAIL_PROVIDER=console`).

**Expected audit (platform):** tenant create event (platform audit if exposed; tenant-side audit starts after owner login).

---

## Part B — School admin: first login and academic setup

1. Sign out of platform console.
2. Sign in at **/** with tenant slug `demo-gamma` and the owner credentials.
3. **Academic Setup** (`/dashboard/academics/years`):
   - Confirm or create an **active** academic year (e.g. `2026-2027`).
   - Add at least one **grade** (e.g. Grade 1) and **subject** (e.g. Mathematics).
4. **Structure** (`/dashboard/academics/structure`):
   - Create a **classroom** for the active year and grade.
5. **Fees & Billing** → enrollment fee plans (optional but recommended for enrollment demo):
   - Link fee items to the grade for the active year.

---

## Part C — Invite a staff user

1. **Team** (`/dashboard/people`) → invite a user (e.g. `teacher@demo-gamma.edu.mm`).
2. Copy the temporary password from the API console email.
3. Sign out. Sign in as the invited user with the same tenant slug.
4. Confirm the user lands on the dashboard with the assigned role permissions.

---

## Part D — Sensitive correction with required reason

Demonstrate audit reasons on at least one flow:

### Finance — verify payment

1. As school owner (or finance role), create a student enrollment or ad-hoc invoice with a **bank/mobile** payment (unverified).
2. Open **Fees & Billing → Payments** or the invoice detail page.
3. Click **Verify payment** — the UI requires a **verification reason**.
4. Submit with a reason such as `Matched KBZ ref 998877 on bank statement`.

### Attendance — correct record (API)

```bash
curl -X PATCH "http://localhost:4000/tenants/<tenantId>/attendance/sessions/<sessionId>/records/<recordId>" \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{"status":"present","correctionReason":"Parent called — student was marked absent by mistake"}'
```

Empty `correctionReason` must return **400**.

### Grading — correct assessment (API)

```bash
curl -X PATCH "http://localhost:4000/tenants/<tenantId>/exam-schedules/<scheduleId>/results/<resultId>" \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{"marksObtained":42,"correctionReason":"Re-marked after script review"}'
```

---

## Part E — Confirm audit trail

1. Sign in as a user with **audit.view** (school owner).
2. Open **Audit Log** (`/dashboard/audit`).
3. Verify entries exist for:
   - Academic setup changes (years, grades, classrooms)
   - User invite / provision
   - Payment verify or refund (with **reason** column populated)
   - Attendance or assessment correction (if exercised)

Filter by record type or scan recent rows for `action` values:

- `payment.verify`, `payment.refund`
- `attendance.correct`
- `assessment.correct`

---

## Part F — Tenant isolation spot check

1. Sign in to tenant **demo-alpha**.
2. Confirm you cannot see `demo-gamma` students, invoices, or settings.
3. Repeat from **demo-beta** if seeded.

Automated check: `npm run test` runs `tenant-isolation.test.ts` when `DATABASE_URL` is set.

---

## Sign-off checklist

- [ ] Platform admin created a new tenant
- [ ] School owner configured academic year, grade, subject, classroom
- [ ] Staff user invited, activated, and signed in
- [ ] Finance verify/refund rejected without reason; succeeded with reason
- [ ] Audit log shows setup and correction events with reasons
- [ ] Two tenants remain isolated

When all boxes are checked, MVP 1 exit criteria for onboarding flow are satisfied.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| API unreachable | `npm run db:up` then `npm run dev` |
| Login fails | Re-run `npm run db:seed`; use exact tenant slug |
| No audit entries | Ensure action used `recordEvent` / `recordSensitiveCorrection` and user has `audit.view` |
| Verify payment 400 | Provide non-empty `reason` in the verify sheet |

See also [operations.md](./operations.md) for staging backups and deployment.
