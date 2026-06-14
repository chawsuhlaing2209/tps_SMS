import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { TenantContext } from "../tenancy/tenant-context.js";
import { RbacService } from "./rbac.service.js";
import { TeacherAssignmentService } from "./teacher-assignment.service.js";

function buildContext(permissions: string[], roles: string[] = ["teacher"]): TenantContext {
  return {
    tenantId: "tenant-a",
    tenantSlug: "tenant-a",
    actorUserId: "user-1",
    roles,
    permissions
  };
}

function createService(db: {
  select: () => {
    from: () => {
      where: (...args: unknown[]) => Promise<unknown[]>;
    };
  };
}) {
  return new TeacherAssignmentService(db as never, new RbacService());
}

describe("TeacherAssignmentService", () => {
  it("skips scoping for users with classroom.manage", () => {
    const service = createService({ select: () => ({ from: () => ({ where: async () => [] }) }) });
    expect(service.requiresAssignmentScoping(buildContext(["classroom.manage", "student.view"]))).toBe(
      false
    );
  });

  it("requires scoping for teachers", () => {
    const service = createService({ select: () => ({ from: () => ({ where: async () => [] }) }) });
    expect(service.requiresAssignmentScoping(buildContext(["student.view", "attendance.mark"]))).toBe(
      true
    );
  });

  it("rejects classroom access when the teacher is not assigned", async () => {
    const service = createService({
      select: () => ({
        from: () => ({
          where: async () => []
        })
      })
    });

    await expect(
      service.assertClassroomAccess(buildContext(["student.view"]), "classroom-1")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows classroom access for assigned subject teachers", async () => {
    let call = 0;
    const service = createService({
      select: () => ({
        from: () => ({
          where: async () => {
            call += 1;
            if (call === 1) {
              return [{ id: "staff-1" }];
            }
            if (call === 2) {
              return [];
            }
            return [{ classroomId: "classroom-1" }];
          }
        })
      })
    });

    await expect(
      service.assertClassroomAccess(buildContext(["student.view"]), "classroom-1")
    ).resolves.toBeUndefined();
  });

  it("allows subject access for class teachers even without an explicit subject row", async () => {
    let call = 0;
    const service = createService({
      select: () => ({
        from: () => ({
          where: async () => {
            call += 1;
            if (call === 1) {
              return [{ id: "staff-1" }];
            }
            return [{ id: "classroom-1" }];
          }
        })
      })
    });

    await expect(
      service.assertClassroomSubjectAccess(
        buildContext(["attendance.mark"]),
        "classroom-1",
        "subject-1"
      )
    ).resolves.toBeUndefined();
  });
});
