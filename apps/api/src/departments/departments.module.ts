import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { DbModule } from "../db/db.module.js";
import { DepartmentsController } from "./departments.controller.js";
import { DepartmentsService } from "./departments.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService]
})
export class DepartmentsModule {}
