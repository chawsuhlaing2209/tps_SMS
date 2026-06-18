import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DbModule } from "../db/db.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { FamilyGroupsController } from "./family-groups.controller.js";
import { StudentsController } from "./students.controller.js";
import { StudentsService } from "./students.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule],
  controllers: [StudentsController, FamilyGroupsController],
  providers: [StudentsService],
  exports: [StudentsService]
})
export class StudentsModule {}
