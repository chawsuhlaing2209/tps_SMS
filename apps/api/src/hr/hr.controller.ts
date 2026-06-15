import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { CreateStaffDto, LinkStaffUserDto, ListStaffQueryDto, UpdateStaffDto } from "./dto.js";
import { HrService } from "./hr.service.js";

@Controller("tenants/:tenantId/hr")
@UseGuards(PermissionsGuard)
@RequirePermissions("hr.manage")
export class HrController {
  constructor(private readonly hrService: HrService) {}

  @Get("staff")
  listStaff(@Param("tenantId") tenantId: string, @Query() query: ListStaffQueryDto) {
    return this.hrService.listStaff(tenantId, query);
  }

  @Post("staff")
  createStaff(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateStaffDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.hrService.createStaff(tenantId, actorUserId, dto);
  }

  @Get("staff/:staffId")
  getStaff(@Param("tenantId") tenantId: string, @Param("staffId") staffId: string) {
    return this.hrService.getStaff(tenantId, staffId);
  }

  @Patch("staff/:staffId")
  updateStaff(
    @Param("tenantId") tenantId: string,
    @Param("staffId") staffId: string,
    @Body() dto: UpdateStaffDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.hrService.updateStaff(tenantId, staffId, actorUserId, dto);
  }

  @Post("staff/:staffId/link-user")
  linkUser(
    @Param("tenantId") tenantId: string,
    @Param("staffId") staffId: string,
    @Body() dto: LinkStaffUserDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.hrService.linkUser(tenantId, staffId, actorUserId, dto);
  }
}
