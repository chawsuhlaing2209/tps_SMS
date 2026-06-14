import { Body, Controller, Get, Headers, Param, Post, UseGuards } from "@nestjs/common";
import { AssignRoleDto, CreateSessionDto, InviteUserDto } from "./dto.js";
import { IdentityManageGuard } from "./identity-manage.guard.js";
import { IdentityService } from "./identity.service.js";

@Controller("tenants/:tenantId/identity")
@UseGuards(IdentityManageGuard)
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post("roles/seed")
  seedRoles(@Param("tenantId") tenantId: string) {
    return this.identityService.seedTenantRoles(tenantId);
  }

  @Get("roles")
  listRoles(@Param("tenantId") tenantId: string) {
    return this.identityService.listTenantRoles(tenantId);
  }

  @Get("users")
  listUsers(@Param("tenantId") tenantId: string) {
    return this.identityService.listTenantUsers(tenantId);
  }

  @Post("users/invite")
  inviteUser(
    @Param("tenantId") tenantId: string,
    @Body() dto: InviteUserDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.identityService.inviteUser(tenantId, dto, actorUserId);
  }

  @Post("roles/assign")
  assignRole(
    @Param("tenantId") tenantId: string,
    @Body() dto: AssignRoleDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.identityService.assignRole(tenantId, dto, actorUserId);
  }

  @Post("sessions")
  createSession(@Param("tenantId") tenantId: string, @Body() dto: CreateSessionDto) {
    return this.identityService.createSession(tenantId, dto);
  }
}
