import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { DbModule } from "../db/db.module.js";
import { LeavesController } from "./leaves.controller.js";
import { LeavesService } from "./leaves.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule],
  controllers: [LeavesController],
  providers: [LeavesService],
  exports: [LeavesService]
})
export class LeavesModule {}
