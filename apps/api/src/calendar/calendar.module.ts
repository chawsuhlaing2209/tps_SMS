import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { DbModule } from "../db/db.module.js";
import { CalendarController } from "./calendar.controller.js";
import { CalendarService } from "./calendar.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule],
  controllers: [CalendarController],
  providers: [CalendarService]
})
export class CalendarModule {}
