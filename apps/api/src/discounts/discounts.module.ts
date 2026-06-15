import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { DbModule } from "../db/db.module.js";
import { DiscountsController } from "./discounts.controller.js";
import { DiscountsService } from "./discounts.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule],
  controllers: [DiscountsController],
  providers: [DiscountsService]
})
export class DiscountsModule {}
