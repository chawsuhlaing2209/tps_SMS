import { Module, forwardRef } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DbModule } from "../db/db.module.js";
import { DepartmentsModule } from "../departments/departments.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { HrController } from "./hr.controller.js";
import { HrService } from "./hr.service.js";
import { TeacherAssignmentsService } from "./teacher-assignments.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule, DepartmentsModule, forwardRef(() => IdentityModule)],
  controllers: [HrController],
  providers: [HrService, TeacherAssignmentsService],
  exports: [HrService, TeacherAssignmentsService]
})
export class HrModule {}
