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
  CreateGuardianDto,
  CreateStudentDto,
  EnrollStudentDto,
  LinkGuardianDto,
  ListStudentsQueryDto,
  TransferStudentDto,
  UpdateStudentDto,
  WithdrawStudentDto
} from "./dto.js";
import { StudentsService } from "./students.service.js";

@Controller("tenants/:tenantId/students")
@UseGuards(PermissionsGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @RequireAnyPermissions("student.manage", "student.view")
  list(
    @Param("tenantId") tenantId: string,
    @Query() query: ListStudentsQueryDto
  ) {
    return this.studentsService.list(tenantId, query);
  }

  @Get("guardians")
  @RequireAnyPermissions("student.manage", "student.view")
  listGuardians(@Param("tenantId") tenantId: string) {
    return this.studentsService.listGuardians(tenantId);
  }

  @Get(":studentId")
  @RequireAnyPermissions("student.manage", "student.view")
  getById(
    @Param("tenantId") tenantId: string,
    @Param("studentId") studentId: string
  ) {
    return this.studentsService.getById(tenantId, studentId);
  }

  @Get(":studentId/timeline")
  @RequirePermissions("student.manage")
  getTimeline(
    @Param("tenantId") tenantId: string,
    @Param("studentId") studentId: string
  ) {
    return this.studentsService.getTimeline(tenantId, studentId);
  }

  @Post()
  @RequirePermissions("student.manage")
  create(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateStudentDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.studentsService.create(tenantId, actorUserId, dto);
  }

  @Post("guardians")
  @RequirePermissions("student.manage")
  createGuardian(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateGuardianDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.studentsService.createGuardian(tenantId, actorUserId, dto);
  }

  @Post(":studentId/guardians")
  @RequirePermissions("student.manage")
  linkGuardian(
    @Param("tenantId") tenantId: string,
    @Param("studentId") studentId: string,
    @Body() dto: LinkGuardianDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.studentsService.linkGuardian(tenantId, studentId, actorUserId, dto);
  }

  @Patch(":studentId")
  @RequirePermissions("student.manage")
  update(
    @Param("tenantId") tenantId: string,
    @Param("studentId") studentId: string,
    @Body() dto: UpdateStudentDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.studentsService.update(tenantId, studentId, actorUserId, dto);
  }

  @Post(":studentId/enroll")
  @RequirePermissions("student.manage")
  enroll(
    @Param("tenantId") tenantId: string,
    @Param("studentId") studentId: string,
    @Body() dto: EnrollStudentDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.studentsService.enroll(tenantId, studentId, actorUserId, dto);
  }

  @Post(":studentId/transfer")
  @RequirePermissions("student.manage")
  transfer(
    @Param("tenantId") tenantId: string,
    @Param("studentId") studentId: string,
    @Body() dto: TransferStudentDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.studentsService.transfer(tenantId, studentId, actorUserId, dto);
  }

  @Post(":studentId/withdraw")
  @RequirePermissions("student.manage")
  withdraw(
    @Param("tenantId") tenantId: string,
    @Param("studentId") studentId: string,
    @Body() dto: WithdrawStudentDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.studentsService.withdraw(tenantId, studentId, actorUserId, dto);
  }
}
