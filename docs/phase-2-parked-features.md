# Phase-2 parked features (removed from MVP launch)

This launch ships **enrollment → billing/finance, people/HR, academic setup, timetable, and admissions**. Daily-teaching and assessment modules (MVP-3 / MVP-4 in [`packages/shared/src/backlog.ts`](../packages/shared/src/backlog.ts)) are **parked**, not deleted.

## Where the full code lives

The complete pre-trim codebase — every module below, wired and working — is preserved on the **`phase-2` branch** (`origin/phase-2`, cut from commit `707f18c`). To resume any module, diff it back from there:

```bash
git checkout phase-2 -- apps/api/src/<module>       # bring a module back
git diff main phase-2 -- apps/api/src/app.module.ts # see how it was wired
```

Do **not** re-create these from scratch — restore from `phase-2` so the audited logic, DTOs, and tests come with them.

## What was removed from `main` (and how to restore)

### API modules (deleted from `apps/api/src/`, unwired from `app.module.ts`)

| Module | Directory | Notes |
|---|---|---|
| Attendance | `attendance/` | sessions, records, corrections (audited) |
| LMS | `lms/` | classroom materials + assignments |
| Exams | `exams/` | exam cycles + schedules |
| Grading | `grading/` | grade rules, assessment results |
| Report cards | `report-cards/` | generate / approve / publish + PDF |
| Calendar | `calendar/` | calendar events (API only, no UI was built) |

### Shared package (`packages/shared/src/`)

- `roles.ts` — removed permissions: `attendance.mark`, `attendance.correct`, `attendance.audit.view`, `lms.manage`, `exam.manage`, `grade.submit`, `grade.approve`, `report_card.generate`, `report_card.approve`, `calendar.manage`. The `teacher` role is now `["student.view"]` only.
- `permission-catalog.ts` — the "academic" group in the user-roles UI dropped the same permissions (kept: classroom, facility, academic setup, timetable).
- `jobs.ts` — removed the `render-report-card-pdf` job type.

### Worker (`apps/worker/src/index.ts`)

- Removed the `render-report-card-pdf` queue handler.

### Web surfaces (`apps/web/`)

- **Classroom room page** (`dashboard/structure/rooms/[classroomId]/`): removed the Attendance and LMS tabs (roster is now the whole page), the "Take attendance" hero button, and the avg-attendance stat. The `?tab=attendance` deep-link no longer exists.
- **Student profile** (`dashboard/students/[studentId]/`): removed the attendance-% and term-GPA stat cards.
- **Teacher profile** (`dashboard/teachers/[teacherId]/`): removed the "To grade" assessment card and the "registers on time" attendance stat (both were demo placeholders).
- **Subject-in-classroom page** (`.../subjects/[subjectId]/`): removed the materials list and assignments panels; it's now a subject header page.

## Deliberately KEPT (still in this launch)

- **Database schema + migrations are untouched.** Tables (`attendance_records`, `attendance_sessions`, `assessment_results`, `report_cards`, `lesson_materials`, `assignments`, `exam_cycles`, `calendar_events`, …) still exist so parked data models and seeds keep working and phase-2 restoration is drop-in. Nothing was dropped from the DB.
- **Demo seeds** (`apps/api/src/db/seed-demo-*.ts`) still populate these tables for local/demo use.
- **Timetable, calendar of academic structure (terms/years), classrooms, facilities** — timetable stays visible per product decision; only attendance/LMS/exams/grading/report-cards were parked.

## i18n note

The `messages/en.json` / `messages/my.json` keys for parked surfaces (attendance*, lms*, materials*, assignments*, gradeAssessment*, toGrade, registersOnTime, etc.) were left in place — harmless when unreferenced, and they'll be needed verbatim when phase-2 restores the UI. No key was deleted from only one locale.
