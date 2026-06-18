import { Module } from "@nestjs/common";
import { AuthzModule } from "../identity/authz.module.js";
import { DbModule } from "../db/db.module.js";
import { DashboardController } from "./dashboard.controller.js";
import { DashboardService } from "./dashboard.service.js";

@Module({
  imports: [DbModule, AuthzModule],
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}
