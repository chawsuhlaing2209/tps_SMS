import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { RbacService } from "./rbac.service.js";

describe("RbacService", () => {
  const service = new RbacService();

  it("expands role permissions", () => {
    expect(service.permissionsForRoles(["teacher"])).toContain("attendance.mark");
  });

  it("rejects cross-tenant access", () => {
    expect(() =>
      service.assertTenantAccess(
        {
          tenantId: "tenant-a",
          tenantSlug: "tenant-a",
          actorUserId: "user-1",
          roles: ["teacher"],
          permissions: []
        },
        "tenant-b"
      )
    ).toThrow(ForbiddenException);
  });

  it("rejects teachers who are not assigned to the requested class or subject", () => {
    expect(() => service.assertTeacherAssignment(false)).toThrow(ForbiddenException);
    expect(() => service.assertTeacherAssignment(true)).not.toThrow();
  });
});
