import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { RequireAnyPermissions, RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { CreateFacilityRoomDto, UpdateFacilityRoomDto } from "./dto.js";
import { FacilitiesService } from "./facilities.service.js";

@Controller("tenants/:tenantId/facility-rooms")
@UseGuards(PermissionsGuard)
export class FacilitiesController {
  constructor(private readonly facilitiesService: FacilitiesService) {}

  @Get()
  @RequirePermissions("facility.manage")
  listFacilityRooms(@Param("tenantId") tenantId: string) {
    return this.facilitiesService.listFacilityRooms(tenantId);
  }

  @Get("active")
  @RequireAnyPermissions("facility.manage", "classroom.manage", "academic_setup.manage")
  listActiveFacilityRooms(@Param("tenantId") tenantId: string) {
    return this.facilitiesService.listActiveFacilityRooms(tenantId);
  }

  @Post()
  @RequirePermissions("facility.manage")
  createFacilityRoom(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateFacilityRoomDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.facilitiesService.createFacilityRoom(tenantId, actorUserId, dto);
  }

  @Patch(":roomId")
  @RequirePermissions("facility.manage")
  updateFacilityRoom(
    @Param("tenantId") tenantId: string,
    @Param("roomId") roomId: string,
    @Body() dto: UpdateFacilityRoomDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.facilitiesService.updateFacilityRoom(tenantId, roomId, actorUserId, dto);
  }

  @Post(":roomId/archive")
  @RequirePermissions("facility.manage")
  archiveFacilityRoom(
    @Param("tenantId") tenantId: string,
    @Param("roomId") roomId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.facilitiesService.archiveFacilityRoom(tenantId, roomId, actorUserId);
  }

  @Post(":roomId/restore")
  @RequirePermissions("facility.manage")
  restoreFacilityRoom(
    @Param("tenantId") tenantId: string,
    @Param("roomId") roomId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.facilitiesService.restoreFacilityRoom(tenantId, roomId, actorUserId);
  }

  @Delete(":roomId")
  @RequirePermissions("facility.manage")
  deleteFacilityRoom(
    @Param("tenantId") tenantId: string,
    @Param("roomId") roomId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.facilitiesService.deleteFacilityRoom(tenantId, roomId, actorUserId);
  }
}
