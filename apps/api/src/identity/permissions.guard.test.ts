import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { PermissionsGuard } from "./permissions.guard.js";
import type { RequestContextService } from "./request-context.service.js";
import type { TeacherAssignmentService } from "./teacher-assignment.service.js";
import type { TenantContext } from "../tenancy/tenant-context.js";

function buildExecutionContext(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({})
  } as unknown as ExecutionContext;
}

function buildContext(permissions: string[]): TenantContext {
  return {
    tenantId: "tenant-a",
    tenantSlug: "tenant-a",
    actorUserId: "user-1",
    roles: ["accountant"],
    permissions
  };
}

function buildGuard(options: {
  required?: string[];
  mode?: "all" | "any";
  teacherScope?: { classroomIdParam?: string };
  context: TenantContext;
  enforceScope?: ReturnType<typeof vi.fn>;
}) {
  const reflector = {
    getAllAndOverride: (key: string) => {
      if (key === "required_permissions") {
        return options.required;
      }
      if (key === "permissions_mode") {
        return options.mode;
      }
      if (key === "teacher_scope") {
        return options.teacherScope;
      }
      return undefined;
    }
  } as unknown as Reflector;

  const requestContextService = {
    actorFromSessionToken: vi.fn().mockResolvedValue("user-1"),
    resolve: vi.fn().mockResolvedValue(options.context)
  } as unknown as RequestContextService;

  const teacherAssignmentService = {
    enforceScope: options.enforceScope ?? vi.fn().mockResolvedValue(undefined)
  } as unknown as TeacherAssignmentService;

  return {
    guard: new PermissionsGuard(reflector, requestContextService, teacherAssignmentService),
    enforceScope: teacherAssignmentService.enforceScope as ReturnType<typeof vi.fn>
  };
}

describe("PermissionsGuard", () => {
  it("allows when no permissions are required", async () => {
    const { guard } = buildGuard({ context: buildContext([]) });
    const allowed = await guard.canActivate(buildExecutionContext({ params: {}, headers: {} }));

    expect(allowed).toBe(true);
  });

  it("rejects when the actor lacks a required permission", async () => {
    const { guard } = buildGuard({
      required: ["finance.manage"],
      context: buildContext(["report.view"])
    });

    await expect(
      guard.canActivate(
        buildExecutionContext({
          params: { tenantId: "tenant-a" },
          headers: { cookie: "sms_session=token-1" }
        })
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows when the actor holds the required permission", async () => {
    const { guard } = buildGuard({
      required: ["finance.manage"],
      context: buildContext(["finance.manage"])
    });

    const allowed = await guard.canActivate(
      buildExecutionContext({
        params: { tenantId: "tenant-a" },
        headers: { cookie: "sms_session=token-1" }
      })
    );

    expect(allowed).toBe(true);
  });

  it("allows when any permission matches in any mode", async () => {
    const { guard } = buildGuard({
      required: ["attendance.mark", "attendance.audit.view"],
      mode: "any",
      context: buildContext(["attendance.audit.view"])
    });

    const allowed = await guard.canActivate(
      buildExecutionContext({
        params: { tenantId: "tenant-a" },
        headers: { cookie: "sms_session=token-1" }
      })
    );

    expect(allowed).toBe(true);
  });

  it("enforces teacher assignment scope after permissions pass", async () => {
    const enforceScope = vi.fn().mockResolvedValue(undefined);
    const { guard } = buildGuard({
      required: ["student.view"],
      teacherScope: { classroomIdParam: "classroomId" },
      context: buildContext(["student.view"]),
      enforceScope
    });

    await guard.canActivate(
      buildExecutionContext({
        params: { tenantId: "tenant-a", classroomId: "classroom-1" },
        headers: { cookie: "sms_session=token-1" }
      })
    );

    expect(enforceScope).toHaveBeenCalledOnce();
  });
});
