import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException
} from "@nestjs/common";
import type { Request } from "express";
import type { TenantContext } from "../tenancy/tenant-context.js";

export interface TenantRequest extends Request {
  tenantContext?: TenantContext;
}

/** Resolved by {@link PermissionsGuard} from the httpOnly session cookie. */
export const ReqTenantContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest<TenantRequest>();
    if (!request.tenantContext) {
      throw new UnauthorizedException("Missing or expired session.");
    }
    return request.tenantContext;
  }
);
