import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { ClassroomsModule } from "../classrooms/classrooms.module.js";
import { DbModule } from "../db/db.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { AcademicsController } from "./academics.controller.js";
import { AcademicsService } from "./academics.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule, ClassroomsModule],
  controllers: [AcademicsController],
  providers: [AcademicsService],
  exports: [AcademicsService]
})
export class AcademicsModule {}
