import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DbModule } from "../db/db.module.js";
import { EnrollmentsModule } from "../enrollments/enrollments.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { StudentsModule } from "../students/students.module.js";
import { AdmissionsController } from "./admissions.controller.js";
import { AdmissionsService } from "./admissions.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule, EnrollmentsModule, StudentsModule],
  controllers: [AdmissionsController],
  providers: [AdmissionsService],
  exports: [AdmissionsService]
})
export class AdmissionsModule {}
