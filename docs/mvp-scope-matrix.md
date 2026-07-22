# MVP scope matrix — what ships in MVP 1 vs what waits for MVP 2

The single checklist for scope reviews. **If a card, stat, tab, menu item, or copy
string maps to an MVP-2 feature, it must not render anywhere in MVP 1.** The full
MVP-2 code is preserved on the `phase-2` branch (see
[`phase-2-parked-features.md`](phase-2-parked-features.md)); this doc is the
product-level contract for what each phase contains.

---

## MVP 1 — launch scope

### 1. Platform & tenant foundation
- Tenant creation/status/settings/feature flags (platform admin)
- Auth: activation, login, sessions (sliding 12h / 30d absolute), password reset
- RBAC: roles, permission catalog, User Roles page (toggles limited to MVP-1 permissions)
- Audit log: viewer page + audit events on all sensitive writes

### 2. People
- **Students**: directory (name, admission no, household, status, DOB, last updated), profile
  (hero, Outstanding/Paid stat, Guardian stat, tabs: Overview / Family / Balance / Documents,
  classroom memberships, subjects this term, documents, archive/restore/delete guards)
- **Guardians & households**: guardians directory, households, family tree, family groups
- **Teachers**: directory (grade chips, classroom/subject counts — active-year only), profile
  (hero, Periods/week, Classes taught, Students stats; summary; tabs: Overview / Teaching
  Assignments / Salary & Compensation), teaching setup (sectors, competent subjects,
  eligible grades, homeroom/subject assignments, grade chief), qualifications/credentials
- **Staff**: staff directory, provisioning (login + role), departments assignment

### 3. Enrollment
- **Admissions**: enquiries list (translated statuses), enquiry detail, activities, convert →
  enrollment ceremony
- **Enrollment ceremony** (critical product rule): fee preview, discount evaluation (incl.
  sibling rules), invoice preview, atomic confirm with optional payment; assign/move/remove
  classroom; cancel with refund modes; student services (optional recurring fees)

### 4. Academic setup (year structure only — no daily teaching ops)
- Academic years (create/activate/close/archive; counts reflect the year's own grades)
- Terms (per year)
- Subjects (catalog + per-grade mapping)
- Grades & classrooms (grades, rooms, homeroom teacher, grade chief)
- School structure (year → grade → room drill-down)
- Facilities (rooms, capacity, notes)

### 5. Teaching (weekly rhythm)
- **School structure** (first item) and **Timetable**: periods, per-classroom slots,
  publish, teacher conflict checks. *Grade tabs show non-archived grades only.*

### 6. Finance (per academic year + Lifetime)
- Overview (year-scoped: revenue, expenses, net, collection rate, trend, salary by
  department, receivables aging, top overdue)
- Collection roster (per-year + lifetime), record payment
- Invoices (list/detail, generate monthly, send guardian, activity timeline)
- Payments (list, date-range filter, method tabs, verify/refund with reasons)
- Fee structures (components CRUD incl. full edit, per-grade amounts — active grades only)
- Discounts (rules, student discounts, request/approve)

### 7. HR & payroll
- Leaves (types, balances, records)
- Run payroll (runs, records, mark paid, payslip PDF)
- Pay components / deductions; benefit packages; incentive programs; staff compensation

### 8. Settings & admin
- School profile (+logo), school schedule (operating hours), preferences
  (language/timezone/currency/date+time formats — all tables honor them), departments,
  user roles, audit log, notifications bell (discount requests, unverified payments,
  new enquiries), EN/MY locales with full key parity

---

## MVP 2 — parked (must NOT appear anywhere in MVP 1)

Restore from the `phase-2` branch; never rebuild from scratch.

| Feature | Granular elements that must stay hidden in MVP 1 |
|---|---|
| **Attendance** | Attendance module/API; classroom Attendance tab; "Take attendance" buttons; session lists/marking; attendance % on student profile; avg-attendance on room detail; "registers on time" stats; attendance permissions & role toggles; attendance CSV exports |
| **Grading & assessment** | Grading/exams APIs; grade rules; assessment results; **Avg class score** card (teacher profile); **Term GPA** (student profile); "To grade" queues; enter/approve-grades role toggles; exam cycles/schedules |
| **Report cards** | Report-cards API; generate/approve/publish flows; report-card PDF job; view/edit report-card role toggles |
| **LMS** | LMS API; classroom LMS tab; materials/assignments lists (classroom + subject pages); student assignment/submission views |
| **Calendar (events)** | Calendar events API; any calendar-event UI (school schedule/operating hours is MVP 1 and stays) |

**Also banned from MVP 1** (not features, but caught in the same sweeps):
- Hardcoded demo/placeholder cards presented as real data (e.g. fake "Today's classes",
  fake "14 leave days left", permanent "—" placeholder stats like "Best month")
- Copy that references parked features or the wrong module (each page's description
  must describe that page only)

---

## Sweep log (remnants found & removed)

| Date | Surface | Remnant | Action |
|---|---|---|---|
| 2026-07-22 | Classroom room page | Attendance + LMS tabs, Take-attendance CTA, avg-attendance stat | removed (trim) |
| 2026-07-22 | Student profile | Attendance % + Term GPA stats | removed (trim) |
| 2026-07-22 | User Roles | attendance/grade/exam/report-card/LMS toggles | removed (trim) |
| 2026-07-22 | Teacher profile | "To grade" card, "registers on time" stat | removed (trim) |
| 2026-07-22 | Teacher profile | **Avg class score** stat card + API field | removed (this sweep) |
| 2026-07-22 | Teacher profile | Fake "Today's classes" + fake "14 leave days left" cards | removed (this sweep) |
| 2026-07-22 | Student profile | "Best month" permanent-placeholder stat | removed (this sweep) |
| 2026-07-22 | Terms page | Generic "subjects, grades, classrooms, bulk import/export" description | replaced with terms-specific copy |
| 2026-07-22 | Sidebar | Dead `exams` translator wiring | removed (this sweep) |

**How to re-run the sweep** (before each release):

```bash
for tok in avgClassScore ClassScore termGpa assessment examCycle reportCard \
           lessonMaterial attendancePercent avgAttendance registersOn toGrade DEMO_; do
  grep -rln "$tok" apps/web/app --include='*.tsx' && echo "^ check: $tok"
done
```

i18n keys for parked surfaces intentionally remain in `messages/{en,my}.json`
(unused keys render nothing and make phase-2 restoration clean) — the sweep targets
**rendered code**, not message files.
