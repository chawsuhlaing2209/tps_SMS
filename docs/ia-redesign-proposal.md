# Sidebar IA redesign — proposal

Status: **implemented** (nav data in `lib/permissions.ts` + `lib/dashboard-nav-submodules.ts`, labels in `messages/{en,my}.json`). Companion to `docs/COMPONENTS.md`.

## 1. Method

The nav is role-filtered, so the IA must work as six different sidebars, not
one. Grouping and order are derived from a **role × frequency** analysis of
each module's real usage:

| Module | Owner | Principal | Registrar (school_admin) | Accountant | HR staff | Teacher | Cadence |
|---|---|---|---|---|---|---|---|
| Overview dashboard | ●● | ●● | ● | ● | ● | ● | daily |
| Student lookup (incl. guardians/households) | ● | ● | ●●● | ●● | – | ●● | daily |
| Fee **collection** / payments | ● | – | – | ●●● | – | – | **daily, peak mornings** |
| Invoices | ● | – | – | ●●● | – | – | daily |
| Leaves | – | ● | – | – | ●●● | ● (request) | daily/weekly |
| Timetable | – | ● | ● | – | – | ●● | weekly |
| Admissions pipeline | ● | ● | ●●● | – | – | – | **seasonal burst** |
| Enrollment ceremony | ● | – | ●●● | ●● | – | – | seasonal burst |
| Run payroll / components / benefits | ● | – | – | ●● | ●●● | – | **monthly ritual** |
| Teachers directory / teaching setup | ● | ●● | ● | – | ● | – | term-start |
| Academic setup (years/terms/subjects/grades) | ● | ● | ● | – | – | – | 1–2×/year |
| Structure / Facilities | ● | ● | ● | – | – | – | 1–2×/year |
| Settings (profile/prefs/schedule/roles) | ●● setup, then rare | ● | – | – | – | – | rare |
| Audit log | ● | ● | – | ● | – | – | on incident |

Touch-point chains that should be adjacent in the IA:
- **Enquiry → enrollment ceremony → invoice → collection** (the product's spine)
- **Staff profile → compensation → payroll run → payslip** and **leaves → payroll**
- **Academic setup → timetable → teaching assignments**

## 2. Diagnosis of the current IA

Current: `SCHOOL` (Overview, Students, Teachers) · `ACADEMICS` (Structure,
Facilities, Academic Setup, Timetable) · `BUSINESS` (Admissions, Enrollments,
Fees & Billing, Salary) · `ADMIN` (Audit Log, Settings, People, Departments).

1. **People are scattered across three groups.** Students + Teachers sit in
   SCHOOL, but non-teaching staff live in ADMIN under the label "People" —
   which collides with the *actual* people hub (`/dashboard/people` =
   students/guardians/households). A registrar looking for a staff member has
   no scent trail to ADMIN.
2. **Frequency inversion.** Daily money work (Collection) is a second-level
   item inside Fees & Billing, while 1–2×/year setup (Structure, Facilities,
   Academic Setup) occupies three top-level slots above it.
3. **Three overlapping homes for school structure.** Structure, Facilities,
   and Academic Setup split years/terms/grades/sections/classrooms/rooms
   across three modules; grades & classrooms are reachable in two of them.
   That's a synonym problem, not a size problem.
4. **Leaves is filed under Salary.** Leave management is an HR daily-op and a
   teacher touch point; payroll is a monthly ritual. Only their *output*
   (unpaid-leave deductions) is shared.
5. **Departments in ADMIN.** It's staff org structure — nobody managing
   departments thinks "admin console".
6. **Group labels are org-chart language, not task language.** "Business" says
   nothing to an accountant looking for "collect fees"; "School" is a filler
   label for "everything else at the top".
7. **No room reserved for the teaching layer.** Attendance, exams, grading,
   report cards exist in the API and will need a home; today they'd have
   nowhere coherent to land.

## 3. Principles

1. **Order by frequency, not org chart** — daily at the top, yearly config at
   the bottom. Every role's filtered sidebar should start with their daily job.
2. **One home per entity** — a person type, a money object, a calendar object
   each live in exactly one place.
3. **Group by job-to-be-done chain** — things used in the same workflow sit
   together (enquiry→enroll, leave→payroll).
4. **Setup is not operations** — anything touched 1–2×/year goes in one
   bottom group, however important it feels.
5. **Names say the task** — group labels a Myanmar school clerk would say out
   loud.

## 4. Proposed IA

```
HOME
 └ Overview                          (dashboard)

PEOPLE                               (daily lookups — one home for every person)
 ├ Students                          (incl. guardians & households, unchanged hub)
 ├ Teachers
 ├ Staff                             (renamed from "People"; profile + compensation)
 └ Departments                       (moved from ADMIN)

ENROLLMENT                           (the seasonal pipeline, in process order)
 ├ Admissions                        (enquiries → offers)
 └ Enrollments                       (ceremony: fees → discounts → confirm)

FINANCE                              (accountant's whole day, frequency-ordered)
 ├ Overview                          (intelligence)
 ├ Collection                        (promoted — the #1 daily task)
 ├ Invoices
 ├ Payments                          (verification queue)
 ├ Fee structures                    (setup-ish, kept here: same owner persona)
 └ Discounts

HR & PAYROLL                         (renamed from "Salary" — covers both jobs)
 ├ Leaves                            (promoted to first — the daily item)
 ├ Run payroll                       (the monthly ritual)
 ├ Deductions                        (pay components)
 └ Bonuses & benefits

TEACHING                             (weekly rhythm; ready for the teaching layer)
 ├ Timetable
 └ (future: Attendance · Exams · Grading · Report cards)

SETUP                                (1–2×/year + rare admin, all in one place)
 ├ Academic setup                    (absorbs Structure + Facilities:
 │   Years · Terms · Subjects · Grades & sections · Classrooms & rooms)
 ├ School profile
 ├ School schedule
 ├ Preferences
 ├ User roles
 └ Audit log
```

### What each role now sees first
- **Accountant:** Overview → Students → **Finance** (Collection second item).
- **Registrar:** Overview → **Students** → Enrollment pipeline.
- **HR staff:** Overview → Staff → **Leaves**.
- **Teacher:** Overview → Students → Timetable (and the future Teaching items).
- **Owner/Principal:** the whole map, in lifecycle order — people → pipeline →
  money → staff → teaching → setup.

## 5. Migration notes

- **Nav-only change for most items** — URLs keep working; only group
  membership, order, and two labels change (`People`→`Staff`,
  `Salary`→`HR & Payroll`). Low-risk, one-file edits in
  `lib/permissions.ts` + `lib/dashboard-nav-submodules.ts` + i18n labels.
- **The one real consolidation is Academic setup absorbing Structure and
  Facilities** (principle #2). That's a navigation merge first (three entries
  become submodules of one), page merges can follow later or never.
- **Audit log moves down, not away** — still one click for owners.
- Old bookmarks unaffected; the sidebar active-state logic already matches by
  path prefix.

## 6. Open questions (need Chaw Su's call)

1. Group label bikeshed: `ENROLLMENT` vs `ADMISSIONS` as the group name — the
   group contains both; which word do Myanmar school staff reach for?
2. Should **Fee structures / Discounts** move to SETUP instead? They're
   config, but accountants own them — I kept them in FINANCE for persona
   coherence. Defensible either way.
3. Is **Departments** better under HR & PAYROLL than PEOPLE? I chose PEOPLE
   (it's a directory), but HR-first schools may disagree.
4. When Attendance ships, does it belong in TEACHING (teacher marks it) or
   PEOPLE (registrar corrects it)? Proposal: TEACHING, with corrections
   reachable from the student profile.
