import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { DbModule } from "../db/db.module.js";
import { FacilitiesController } from "./facilities.controller.js";
import { FacilitiesService } from "./facilities.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule],
  controllers: [FacilitiesController],
  providers: [FacilitiesService],
  exports: [FacilitiesService]
})
export class FacilitiesModule {}
