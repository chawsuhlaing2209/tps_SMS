import { Body, Controller, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { LoginDto } from "./auth.dto.js";
import { AuthService } from "./auth.service.js";
import {
  clearSessionCookie,
  readSessionCookie,
  setSessionCookie
} from "./session-cookie.js";

@Controller("platform/auth")
export class PlatformAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, ...rest } = await this.authService.platformLogin(dto);
    setSessionCookie(res, token);
    return rest;
  }

  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.logout(readSessionCookie(req));
    clearSessionCookie(res);
    return result;
  }
}
