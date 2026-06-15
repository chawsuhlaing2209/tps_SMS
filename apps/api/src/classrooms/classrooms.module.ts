import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DbModule } from "../db/db.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { ClassroomsController } from "./classrooms.controller.js";
import { ClassroomsService } from "./classrooms.service.js";

@Module({
  imports: [DbModule, AuthzModule, AuditModule],
  controllers: [ClassroomsController],
  providers: [ClassroomsService],
  exports: [ClassroomsService]
})
export class ClassroomsModule {}
