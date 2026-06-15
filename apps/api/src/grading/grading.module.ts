import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DbModule } from "../db/db.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { GradingController } from "./grading.controller.js";
import { GradingService } from "./grading.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule],
  controllers: [GradingController],
  providers: [GradingService],
  exports: [GradingService]
})
export class GradingModule {}
