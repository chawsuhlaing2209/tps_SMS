import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { RequireAnyPermissions, RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import {
  CreateGuardianDto,
  CreateStudentDto,
  CreateStudentFamilyGroupDto,
  EnrollStudentDto,
  LinkGuardianDto,
  ListStudentsQueryDto,
  ListGuardiansQueryDto,
  SetStudentFamilyGroupDto,
  TransferStudentDto,
  UpdateGuardianDto,
  UpdateStudentDto,
  WithdrawStudentDto
} from "./dto.js";
import { StudentDocumentsService } from "./student-documents.service.js";
import { StudentsService } from "./students.service.js";

@Controller("tenants/:tenantId/students")
@UseGuards(PermissionsGuard)
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly studentDocumentsService: StudentDocumentsService
  ) {}

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
  listGuardians(
    @Param("tenantId") tenantId: string,
    @Query() query: ListGuardiansQueryDto
  ) {
    return this.studentsService.listGuardians(tenantId, query);
  }

  @Get("directory-counts")
  @RequireAnyPermissions("student.manage", "student.view")
  directoryCounts(@Param("tenantId") tenantId: string) {
    return this.studentsService.getPeopleDirectoryCounts(tenantId);
  }

  @Get("guardians/:guardianId")
  @RequireAnyPermissions("student.manage", "student.view")
  getGuardian(
    @Param("tenantId") tenantId: string,
    @Param("guardianId") guardianId: string
  ) {
    return this.studentsService.getGuardian(tenantId, guardianId);
  }

  @Get(":studentId/profile")
  @RequireAnyPermissions("student.manage", "student.view")
  getProfile(
    @Param("tenantId") tenantId: string,
    @Param("studentId") studentId: string
  ) {
    return this.studentsService.getProfile(tenantId, studentId);
  }

  @Get(":studentId/documents")
  @RequireAnyPermissions("student.manage", "student.view")
  listDocuments(
    @Param("tenantId") tenantId: string,
    @Param("studentId") studentId: string
  ) {
    return this.studentDocumentsService.list(tenantId, studentId);
  }

  @Post(":studentId/documents")
  @RequirePermissions("student.manage")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024 }
    })
  )
  uploadDocument(
    @Param("tenantId") tenantId: string,
    @Param("studentId") studentId: string,
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.studentDocumentsService.upload(tenantId, studentId, actorUserId, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
  }

  @Get(":studentId/documents/:documentId/file")
  @RequireAnyPermissions("student.manage", "student.view")
  downloadDocument(
    @Param("tenantId") tenantId: string,
    @Param("studentId") studentId: string,
    @Param("documentId") documentId: string
  ) {
    return this.studentDocumentsService.download(tenantId, studentId, documentId);
  }

  @Delete(":studentId/documents/:documentId")
  @RequirePermissions("student.manage")
  deleteDocument(
    @Param("tenantId") tenantId: string,
    @Param("studentId") studentId: string,
    @Param("documentId") documentId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.studentDocumentsService.delete(tenantId, studentId, documentId, actorUserId);
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

  @Patch("guardians/:guardianId")
  @RequirePermissions("student.manage")
  updateGuardian(
    @Param("tenantId") tenantId: string,
    @Param("guardianId") guardianId: string,
    @Body() dto: UpdateGuardianDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.studentsService.updateGuardian(tenantId, guardianId, actorUserId, dto);
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

  @Patch(":studentId/family-group")
  @RequirePermissions("student.manage")
  setFamilyGroup(
    @Param("tenantId") tenantId: string,
    @Param("studentId") studentId: string,
    @Body() dto: SetStudentFamilyGroupDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.studentsService.setStudentFamilyGroup(tenantId, studentId, actorUserId, dto);
  }

  @Post(":studentId/family-group")
  @RequirePermissions("student.manage")
  createFamilyGroup(
    @Param("tenantId") tenantId: string,
    @Param("studentId") studentId: string,
    @Body() dto: CreateStudentFamilyGroupDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.studentsService.createFamilyGroupForStudent(tenantId, studentId, actorUserId, dto);
  }

  /** @deprecated Prefer POST /enrollments with the enrollment ceremony wizard. */
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

  @Get(":studentId")
  @RequireAnyPermissions("student.manage", "student.view")
  getById(
    @Param("tenantId") tenantId: string,
    @Param("studentId") studentId: string
  ) {
    return this.studentsService.getById(tenantId, studentId);
  }
}
