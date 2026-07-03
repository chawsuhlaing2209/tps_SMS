import { Module } from "@nestjs/common";
import { AuthzModule } from "../identity/authz.module.js";
import { DbModule } from "../db/db.module.js";
import { ArchiveController } from "./archive.controller.js";
import { ArchiveService } from "./archive.service.js";

@Module({
  imports: [DbModule, AuthzModule],
  controllers: [ArchiveController],
  providers: [ArchiveService],
  exports: [ArchiveService]
})
export class ArchiveModule {}
