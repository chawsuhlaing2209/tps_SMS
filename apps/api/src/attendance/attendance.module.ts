import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { AuditModule } from "../audit/audit.module.js";
import {
  AttendanceSessionsController,
  ClassroomAttendanceController,
  AttendanceReportController
} from "./attendance.controller.js";
import { AttendanceService } from "./attendance.service.js";

@Module({
  imports: [DbModule, AuthzModule, AuditModule],
  controllers: [AttendanceSessionsController, ClassroomAttendanceController, AttendanceReportController],
  providers: [AttendanceService],
  exports: [AttendanceService]
})
export class AttendanceModule {}
