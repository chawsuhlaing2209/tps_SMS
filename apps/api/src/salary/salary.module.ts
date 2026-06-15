import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DbModule } from "../db/db.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { SalaryController } from "./salary.controller.js";
import { SalaryService } from "./salary.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule],
  controllers: [SalaryController],
  providers: [SalaryService],
  exports: [SalaryService]
})
export class SalaryModule {}
