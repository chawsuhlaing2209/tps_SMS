DELETE FROM "grade_subjects" AS a
USING "grade_subjects" AS b
WHERE a.id > b.id
  AND a.tenant_id = b.tenant_id
  AND a.academic_year_id = b.academic_year_id
  AND a.grade_id = b.grade_id
  AND a.subject_id = b.subject_id;
--> statement-breakpoint
DELETE FROM "grade_subjects" AS gs
WHERE gs.id IN (
  SELECT gs_keep.id
  FROM "grade_subjects" AS gs_keep
  INNER JOIN "grade_subjects" AS gs_dup
    ON gs_keep.tenant_id = gs_dup.tenant_id
    AND gs_keep.academic_year_id = gs_dup.academic_year_id
    AND gs_keep.grade_id = gs_dup.grade_id
    AND gs_keep.id > gs_dup.id
  INNER JOIN "subjects" AS s1 ON s1.id = gs_keep.subject_id
  INNER JOIN "subjects" AS s2 ON s2.id = gs_dup.subject_id
  WHERE s1.code IS NOT NULL
    AND s2.code IS NOT NULL
    AND lower(trim(s1.code)) = lower(trim(s2.code))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "grade_subjects_year_grade_subject_unique" ON "grade_subjects" USING btree ("tenant_id","academic_year_id","grade_id","subject_id");
