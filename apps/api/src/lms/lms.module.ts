import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DbModule } from "../db/db.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { LmsController } from "./lms.controller.js";
import { LmsService } from "./lms.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule],
  controllers: [LmsController],
  providers: [LmsService],
  exports: [LmsService]
})
export class LmsModule {}
