---
name: grade-classroom-invariants
description: Grade/classroom module interaction invariants enforced in SMS api services (2026-06-25)
metadata:
  type: project
---

Audited + hardened the grade (`academics.service.ts`) and classroom
(`classrooms.service.ts`) modules on 2026-06-25. Invariants now enforced in
service code (with colocated specs guarding them):

1. A classroom can only be created/moved onto an **active** grade.
   `createClassroom` + `updateClassroom` select `grades.status` and throw
   `BadRequestException` for archived grades.
2. When `updateClassroom` changes the grade but keeps the existing homeroom
   teacher (teacher not in the DTO), the teacher's homeroom eligibility is
   re-checked against the **new** grade via `assertTeacherEligibleForHomeroom`.
3. Grade `minAge` must be `<= maxAge`. Enforced in service via
   `assertValidAgeRange` on create + update (update merges DTO over previous row,
   since the DTO can't cross-validate against stored values). DTO only has
   `@Min(0)` per field.

Specs: `apps/api/src/academics/academics.service.spec.ts` (5),
`apps/api/src/classrooms/classrooms.service.spec.ts` (5). Both use the same
chainable Drizzle stub pattern (queued select results, `where` resolves the
next array) documented in [[test-commands]].

Grades/subjects/sections use soft-delete (status archived), not hard delete;
archiving a grade does NOT cascade to existing classrooms (by design).
