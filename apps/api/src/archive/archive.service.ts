import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import {
  benefitPackages,
  feeItems,
  grades,
  incentivePrograms,
  sections,
  staff,
  students,
  subjects,
  tenantSettings
} from "../db/schema.js";
import { purgeArchivedForTenant } from "./purge-archived-runner.js";

/** One archived record, normalized across modules for the recycle bin. */
export type RecycleBinItem = {
  type:
    | "student"
    | "staff"
    | "grade"
    | "section"
    | "subject"
    | "feeItem"
    | "benefitPackage"
    | "incentiveProgram";
  id: string;
  label: string;
  sublabel: string | null;
  archivedAt: string | null;
};

@Injectable()
export class ArchiveService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Aggregate archived records across the deletable structural modules. */
  async getRecycleBin(tenantId: string): Promise<{ items: RecycleBinItem[] }> {
    const [
      studentRows,
      staffRows,
      gradeRows,
      sectionRows,
      subjectRows,
      feeItemRows,
      benefitRows,
      incentiveRows
    ] = await Promise.all([
        this.db
          .select({
            id: students.id,
            label: students.fullName,
            sublabel: students.admissionNumber,
            archivedAt: students.archivedAt
          })
          .from(students)
          .where(and(eq(students.tenantId, tenantId), isNotNull(students.archivedAt)))
          .orderBy(desc(students.archivedAt)),
        this.db
          .select({
            id: staff.id,
            label: staff.fullName,
            sublabel: staff.employeeNumber,
            archivedAt: staff.archivedAt
          })
          .from(staff)
          .where(and(eq(staff.tenantId, tenantId), isNotNull(staff.archivedAt)))
          .orderBy(desc(staff.archivedAt)),
        this.db
          .select({ id: grades.id, label: grades.name, updatedAt: grades.updatedAt })
          .from(grades)
          .where(and(eq(grades.tenantId, tenantId), eq(grades.status, "archived"))),
        this.db
          .select({ id: sections.id, label: sections.name, updatedAt: sections.updatedAt })
          .from(sections)
          .where(and(eq(sections.tenantId, tenantId), eq(sections.status, "archived"))),
        this.db
          .select({
            id: subjects.id,
            label: subjects.name,
            sublabel: subjects.code,
            updatedAt: subjects.updatedAt
          })
          .from(subjects)
          .where(and(eq(subjects.tenantId, tenantId), eq(subjects.status, "archived"))),
        this.db
          .select({ id: feeItems.id, label: feeItems.name, updatedAt: feeItems.updatedAt })
          .from(feeItems)
          .where(and(eq(feeItems.tenantId, tenantId), eq(feeItems.status, "archived"))),
        this.db
          .select({ id: benefitPackages.id, label: benefitPackages.name, updatedAt: benefitPackages.updatedAt })
          .from(benefitPackages)
          .where(and(eq(benefitPackages.tenantId, tenantId), eq(benefitPackages.status, "archived"))),
        this.db
          .select({ id: incentivePrograms.id, label: incentivePrograms.name, updatedAt: incentivePrograms.updatedAt })
          .from(incentivePrograms)
          .where(and(eq(incentivePrograms.tenantId, tenantId), eq(incentivePrograms.status, "archived")))
      ]);

    const toIso = (value: Date | string | null | undefined) =>
      value == null ? null : value instanceof Date ? value.toISOString() : String(value);

    const items: RecycleBinItem[] = [
      ...studentRows.map((r) => ({
        type: "student" as const,
        id: r.id,
        label: r.label,
        sublabel: r.sublabel,
        archivedAt: toIso(r.archivedAt)
      })),
      ...staffRows.map((r) => ({
        type: "staff" as const,
        id: r.id,
        label: r.label,
        sublabel: r.sublabel,
        archivedAt: toIso(r.archivedAt)
      })),
      ...gradeRows.map((r) => ({
        type: "grade" as const,
        id: r.id,
        label: r.label,
        sublabel: null,
        archivedAt: toIso(r.updatedAt)
      })),
      ...sectionRows.map((r) => ({
        type: "section" as const,
        id: r.id,
        label: r.label,
        sublabel: null,
        archivedAt: toIso(r.updatedAt)
      })),
      ...subjectRows.map((r) => ({
        type: "subject" as const,
        id: r.id,
        label: r.label,
        sublabel: r.sublabel,
        archivedAt: toIso(r.updatedAt)
      })),
      ...feeItemRows.map((r) => ({
        type: "feeItem" as const,
        id: r.id,
        label: r.label,
        sublabel: null,
        archivedAt: toIso(r.updatedAt)
      })),
      ...benefitRows.map((r) => ({
        type: "benefitPackage" as const,
        id: r.id,
        label: r.label,
        sublabel: null,
        archivedAt: toIso(r.updatedAt)
      })),
      ...incentiveRows.map((r) => ({
        type: "incentiveProgram" as const,
        id: r.id,
        label: r.label,
        sublabel: null,
        archivedAt: toIso(r.updatedAt)
      }))
    ];

    // Most-recently archived first; nulls last.
    items.sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? ""));

    return { items };
  }

  /** Run the retention auto-purge for one tenant now (manual trigger). */
  async purgeNow(tenantId: string) {
    const [settings] = await this.db
      .select({ days: tenantSettings.archiveRetentionDays })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId));
    const days = settings?.days ?? 0;
    return purgeArchivedForTenant(this.db, tenantId, days);
  }
}
