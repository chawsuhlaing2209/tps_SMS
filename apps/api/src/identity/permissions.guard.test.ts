import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { PermissionsGuard } from "./permissions.guard.js";
import type { RequestContextService } from "./request-context.service.js";
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

describe("PermissionsGuard", () => {
  it("allows when no permissions are required", async () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const requestContextService = {
      resolve: vi.fn()
    } as unknown as RequestContextService;

    const guard = new PermissionsGuard(reflector, requestContextService);
    const allowed = await guard.canActivate(buildExecutionContext({ params: {}, headers: {} }));

    expect(allowed).toBe(true);
  });

  it("rejects when the actor lacks a required permission", async () => {
    const reflector = {
      getAllAndOverride: () => ["finance.manage"]
    } as unknown as Reflector;
    const requestContextService = {
      actorFromSessionToken: vi.fn().mockResolvedValue("user-1"),
      resolve: vi.fn().mockResolvedValue(buildContext(["report.view"]))
    } as unknown as RequestContextService;

    const guard = new PermissionsGuard(reflector, requestContextService);

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
    const reflector = {
      getAllAndOverride: () => ["finance.manage"]
    } as unknown as Reflector;
    const requestContextService = {
      actorFromSessionToken: vi.fn().mockResolvedValue("user-1"),
      resolve: vi.fn().mockResolvedValue(buildContext(["finance.manage"]))
    } as unknown as RequestContextService;

    const guard = new PermissionsGuard(reflector, requestContextService);

    const allowed = await guard.canActivate(
      buildExecutionContext({
        params: { tenantId: "tenant-a" },
        headers: { cookie: "sms_session=token-1" }
      })
    );

    expect(allowed).toBe(true);
  });
});
