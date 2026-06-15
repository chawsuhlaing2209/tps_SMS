import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DbModule } from "../db/db.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { ReportCardsController } from "./report-cards.controller.js";
import { ReportCardsService } from "./report-cards.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule],
  controllers: [ReportCardsController],
  providers: [ReportCardsService],
  exports: [ReportCardsService]
})
export class ReportCardsModule {}
