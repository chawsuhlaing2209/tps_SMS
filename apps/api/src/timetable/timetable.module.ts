import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { ClassroomsModule } from "../classrooms/classrooms.module.js";
import { DbModule } from "../db/db.module.js";
import { SchoolScheduleModule } from "../school-schedule/school-schedule.module.js";
import { TimetableController } from "./timetable.controller.js";
import { TimetableService } from "./timetable.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule, SchoolScheduleModule, ClassroomsModule],
  controllers: [TimetableController],
  providers: [TimetableService]
})
export class TimetableModule {}
