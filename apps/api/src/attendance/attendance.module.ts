import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { AttendanceSessionsController, ClassroomAttendanceController } from "./attendance.controller.js";
import { AttendanceService } from "./attendance.service.js";

@Module({
  imports: [DbModule, AuthzModule],
  controllers: [AttendanceSessionsController, ClassroomAttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService]
})
export class AttendanceModule {}
