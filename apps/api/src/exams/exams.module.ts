import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DbModule } from "../db/db.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { ExamsController } from "./exams.controller.js";
import { ExamsService } from "./exams.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule],
  controllers: [ExamsController],
  providers: [ExamsService],
  exports: [ExamsService]
})
export class ExamsModule {}
