import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DbModule } from "../db/db.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { SchoolProfileController } from "./school-profile.controller.js";
import { SchoolProfileService } from "./school-profile.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule, StorageModule],
  controllers: [SchoolProfileController],
  providers: [SchoolProfileService],
  exports: [SchoolProfileService]
})
export class SchoolProfileModule {}
