import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DbModule } from "../db/db.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { EnrollmentsController } from "./enrollments.controller.js";
import { EnrollmentsService } from "./enrollments.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
  exports: [EnrollmentsService]
})
export class EnrollmentsModule {}
