import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DbModule } from "../db/db.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { HrController } from "./hr.controller.js";
import { HrService } from "./hr.service.js";
import { TeacherAssignmentsService } from "./teacher-assignments.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule],
  controllers: [HrController],
  providers: [HrService, TeacherAssignmentsService],
  exports: [HrService, TeacherAssignmentsService]
})
export class HrModule {}
