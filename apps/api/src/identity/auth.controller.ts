import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import type { TenantContext } from "../tenancy/tenant-context.js";
import {
  ActivateAccountDto,
  ConfirmPasswordResetDto,
  LoginDto,
  RequestPasswordResetDto,
  RevokeSessionDto
} from "./auth.dto.js";
import { AuthService } from "./auth.service.js";
import { RequirePermissions } from "./permissions.decorator.js";
import { PermissionsGuard } from "./permissions.guard.js";
import {
  clearSessionCookie,
  readSessionCookie,
  setSessionCookie
} from "./session-cookie.js";

@Controller("tenants/:tenantId/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("activate")
  activate(@Param("tenantId") tenantId: string, @Body() dto: ActivateAccountDto) {
    return this.authService.activateAccount(tenantId, dto);
  }

  @Post("login")
  async login(
    @Param("tenantId") tenantId: string,
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const { token, ...rest } = await this.authService.login(tenantId, dto);
    setSessionCookie(res, token);
    // The token is delivered only as an httpOnly cookie, never in the body, so
    // browser JavaScript cannot read it.
    return rest;
  }

  @Get("me")
  me(@Param("tenantId") tenantId: string, @Req() req: Request) {
    return this.authService.getProfile(tenantId, readSessionCookie(req));
  }

  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.logout(readSessionCookie(req));
    clearSessionCookie(res);
    return result;
  }

  @Post("password-reset/request")
  requestPasswordReset(
    @Param("tenantId") tenantId: string,
    @Body() dto: RequestPasswordResetDto
  ) {
    return this.authService.requestPasswordReset(tenantId, dto);
  }

  @Post("password-reset/confirm")
  confirmPasswordReset(
    @Param("tenantId") tenantId: string,
    @Body() dto: ConfirmPasswordResetDto
  ) {
    return this.authService.confirmPasswordReset(tenantId, dto);
  }

  @Post("sessions/revoke")
  @UseGuards(PermissionsGuard)
  @RequirePermissions("identity.manage")
  revoke(
    @Param("tenantId") tenantId: string,
    @Body() dto: RevokeSessionDto,
    @Req() req: Request
  ) {
    const actorUserId = (req as Request & { tenantContext?: TenantContext }).tenantContext
      ?.actorUserId;
    return this.authService.revokeSession(tenantId, dto, actorUserId);
  }
}
