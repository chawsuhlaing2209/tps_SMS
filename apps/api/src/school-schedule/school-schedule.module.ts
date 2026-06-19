import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { DbModule } from "../db/db.module.js";
import { SchoolScheduleController } from "./school-schedule.controller.js";
import { SchoolScheduleService } from "./school-schedule.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule],
  controllers: [SchoolScheduleController],
  providers: [SchoolScheduleService],
  exports: [SchoolScheduleService]
})
export class SchoolScheduleModule {}
