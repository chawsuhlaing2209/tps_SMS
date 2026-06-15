import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { DbModule } from "../db/db.module.js";
import { TimetableController } from "./timetable.controller.js";
import { TimetableService } from "./timetable.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule],
  controllers: [TimetableController],
  providers: [TimetableService]
})
export class TimetableModule {}
