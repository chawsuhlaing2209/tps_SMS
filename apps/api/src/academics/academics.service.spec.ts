import { BadRequestException, NotFoundException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AcademicsService } from "./academics.service.js";
import type { Database } from "../db/db.module.js";
import type { AuditService } from "../audit/audit.service.js";
import type { CreateGradeDto, UpdateGradeDto } from "./dto.js";

/**
 * Grade-module interaction tests. Focus: the age-range integrity guard added to
 * createGrade/updateGrade (minAge must not exceed maxAge), plus tenant-scoped
 * lookup behaviour on update. Drizzle + AuditService are mocked.
 */

const TENANT = "11111111-1111-1111-1111-111111111111";
const GRADE_ID = "grade-1";
const ACTOR = "actor-1";

function makeAudit(): AuditService {
  return { recordEvent: vi.fn(() => Promise.resolve({})) } as unknown as AuditService;
}

/** Chainable select stub returning queued result arrays per select() call. */
function makeDb(selectResults: unknown[]) {
  let i = 0;
  const insertedRow = { id: GRADE_ID, name: "Grade 1", minAge: null, maxAge: null };
  const db = {
    select: vi.fn(() => {
      const result = selectResults[i++] ?? [];
      const builder: Record<string, unknown> = {};
      builder.from = vi.fn(() => builder);
      builder.where = vi.fn(() => Promise.resolve(result));
      return builder;
    }),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([insertedRow])) }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([insertedRow])) }))
      }))
    }))
  } as unknown as Database;
  return db;
}

describe("AcademicsService grade age-range validation", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects createGrade when minAge > maxAge before touching the DB", async () => {
    const db = makeDb([]);
    const service = new AcademicsService(db, makeAudit());

    await expect(
      service.createGrade(TENANT, { name: "G1", minAge: 12, maxAge: 6 } as CreateGradeDto, ACTOR)
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(db.insert).not.toHaveBeenCalled();
  });

  it("allows createGrade when minAge <= maxAge", async () => {
    const db = makeDb([]);
    const service = new AcademicsService(db, makeAudit());

    await expect(
      service.createGrade(TENANT, { name: "G1", minAge: 5, maxAge: 6 } as CreateGradeDto, ACTOR)
    ).resolves.toBeDefined();
    expect(db.insert).toHaveBeenCalled();
  });

  it("allows createGrade when ages are omitted (no range to validate)", async () => {
    const db = makeDb([]);
    const service = new AcademicsService(db, makeAudit());

    await expect(
      service.createGrade(TENANT, { name: "G1" } as CreateGradeDto, ACTOR)
    ).resolves.toBeDefined();
  });

  it("rejects updateGrade when the effective range becomes invalid (new minAge vs existing maxAge)", async () => {
    // getGradeOrThrow returns an existing grade with maxAge 6; dto sets minAge 10.
    const db = makeDb([
      [{ id: GRADE_ID, name: "G1", minAge: 4, maxAge: 6, status: "active" }]
    ]);
    const service = new AcademicsService(db, makeAudit());

    await expect(
      service.updateGrade(TENANT, GRADE_ID, { minAge: 10 } as UpdateGradeDto, ACTOR)
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(db.update).not.toHaveBeenCalled();
  });

  it("throws NotFound (tenant-scoped) when updating a grade that does not exist", async () => {
    const db = makeDb([[]]); // getGradeOrThrow → empty
    const service = new AcademicsService(db, makeAudit());

    await expect(
      service.updateGrade(TENANT, GRADE_ID, { minAge: 5 } as UpdateGradeDto, ACTOR)
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
