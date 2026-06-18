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
import { RequireAnyPermissions, RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import {
  CreateFamilyGroupDto,
  SearchFamilyGroupsQueryDto,
  UpdateFamilyGroupDto
} from "./dto.js";
import { StudentsService } from "./students.service.js";

@Controller("tenants/:tenantId/family-groups")
@UseGuards(PermissionsGuard)
export class FamilyGroupsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @RequireAnyPermissions("student.manage", "student.view")
  list(
    @Param("tenantId") tenantId: string,
    @Query() query: SearchFamilyGroupsQueryDto
  ) {
    return this.studentsService.listFamilyGroups(tenantId, query);
  }

  @Post()
  @RequirePermissions("student.manage")
  create(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateFamilyGroupDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.studentsService.createFamilyGroup(tenantId, actorUserId, dto);
  }

  @Get(":familyGroupId")
  @RequireAnyPermissions("student.manage", "student.view")
  getById(
    @Param("tenantId") tenantId: string,
    @Param("familyGroupId") familyGroupId: string
  ) {
    return this.studentsService.getFamilyGroupTree(tenantId, familyGroupId);
  }

  @Patch(":familyGroupId")
  @RequirePermissions("student.manage")
  update(
    @Param("tenantId") tenantId: string,
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: UpdateFamilyGroupDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.studentsService.updateFamilyGroup(tenantId, familyGroupId, actorUserId, dto);
  }
}
