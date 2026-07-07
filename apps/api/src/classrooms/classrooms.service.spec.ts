import { BadRequestException, NotFoundException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClassroomsService } from "./classrooms.service.js";
import type { Database } from "../db/db.module.js";
import type { AuditService } from "../audit/audit.service.js";
import type { TeacherAssignmentService } from "../identity/teacher-assignment.service.js";
import type { CreateClassroomDto, UpdateClassroomDto } from "./dto.js";

/**
 * Classroom-module interaction tests. Focus: the guards that reject attaching a
 * classroom to an archived grade (create + update), and the re-validation of an
 * existing homeroom teacher's eligibility when the grade changes. Drizzle and
 * collaborators are mocked.
 */

const TENANT = "11111111-1111-1111-1111-111111111111";
const CLASSROOM_ID = "classroom-1";
const ACTOR = "actor-1";

function makeAudit(): AuditService {
  return { recordEvent: vi.fn(() => Promise.resolve({})) } as unknown as AuditService;
}

function makeTeacherAssignmentService(): TeacherAssignmentService {
  return {
    assignedClassroomIds: vi.fn(() => Promise.resolve(null))
  } as unknown as TeacherAssignmentService;
}

/** Chainable select stub returning queued result arrays per select() call. */
function makeDb(selectResults: unknown[]) {
  let i = 0;
  const db = {
    select: vi.fn(() => {
      const result = selectResults[i++] ?? [];
      const builder: Record<string, unknown> = {};
      builder.from = vi.fn(() => builder);
      builder.where = vi.fn(() => Promise.resolve(result));
      return builder;
    }),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([{ id: CLASSROOM_ID }])) }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([{ id: CLASSROOM_ID }])) }))
      }))
    }))
  } as unknown as Database;
  return db;
}

function makeService(db: Database) {
  return new ClassroomsService(db, makeTeacherAssignmentService(), makeAudit());
}

describe("ClassroomsService.createClassroom — archived grade guard", () => {
  afterEach(() => vi.restoreAllMocks());

  const baseDto: CreateClassroomDto = {
    academicYearId: "ay-1",
    gradeId: "grade-1",
    name: "Room A"
  } as CreateClassroomDto;

  it("rejects creating a classroom for an archived grade", async () => {
    const db = makeDb([
      [{ id: "ay-1", status: "active" }], // academic year lookup
      [{ id: "grade-1", status: "archived" }] // grade lookup
    ]);
    const service = makeService(db);

    await expect(service.createClassroom(TENANT, baseDto, ACTOR)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("throws NotFound when the grade does not exist (tenant-scoped)", async () => {
    const db = makeDb([
      [{ id: "ay-1", status: "active" }],
      [] // grade lookup empty
    ]);
    const service = makeService(db);

    await expect(service.createClassroom(TENANT, baseDto, ACTOR)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("creates the classroom when the grade is active", async () => {
    const db = makeDb([
      [{ id: "ay-1", status: "active" }],
      [{ id: "grade-1", status: "active" }]
    ]);
    const service = makeService(db);

    await expect(service.createClassroom(TENANT, baseDto, ACTOR)).resolves.toBeDefined();
    expect(db.insert).toHaveBeenCalled();
  });
});

describe("ClassroomsService.updateClassroom — archived grade + homeroom re-check", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects moving a classroom to an archived grade", async () => {
    const db = makeDb([
      // getClassroomOrThrow
      [
        {
          id: CLASSROOM_ID,
          tenantId: TENANT,
          gradeId: "grade-old",
          academicYearId: "ay-1",
          classTeacherStaffId: null,
          name: "Room A",
          capacity: null,
          room: null,
          facilityRoomId: null,
          status: "active"
        }
      ],
      // grade lookup → archived
      [{ id: "grade-new", status: "archived" }]
    ]);
    const service = makeService(db);

    await expect(
      service.updateClassroom(
        TENANT,
        CLASSROOM_ID,
        { gradeId: "grade-new" } as UpdateClassroomDto,
        ACTOR
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("re-checks the existing homeroom teacher's eligibility when the grade changes", async () => {
    const db = makeDb([
      // getClassroomOrThrow — has an existing homeroom teacher
      [
        {
          id: CLASSROOM_ID,
          tenantId: TENANT,
          gradeId: "grade-old",
          academicYearId: "ay-1",
          classTeacherStaffId: "teacher-1",
          name: "Room A",
          capacity: null,
          room: null,
          facilityRoomId: null,
          status: "active"
        }
      ],
      // grade lookup → active
      [{ id: "grade-new", status: "active" }]
    ]);
    const service = makeService(db);

    // Spy on the private eligibility assertion to confirm it is invoked for the
    // KEPT teacher against the NEW grade, and have it reject (ineligible).
    const spy = vi
      .spyOn(
        service as unknown as {
          assertTeacherEligibleForHomeroom: (
            t: string,
            s: string,
            g: string
          ) => Promise<void>;
        },
        "assertTeacherEligibleForHomeroom"
      )
      .mockRejectedValue(new BadRequestException("ineligible"));

    await expect(
      service.updateClassroom(
        TENANT,
        CLASSROOM_ID,
        { gradeId: "grade-new" } as UpdateClassroomDto,
        ACTOR
      )
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(spy).toHaveBeenCalledWith(TENANT, "teacher-1", "grade-new");
  });
});
