import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DbModule } from "../db/db.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { S3StorageService } from "../storage/s3-storage.service.js";
import { PayslipQueueService } from "./payslip-queue.service.js";
import { PayslipRenderService } from "./payslip-render.service.js";
import { PayrollController } from "./payroll.controller.js";
import { PayrollService } from "./payroll.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule],
  controllers: [PayrollController],
  providers: [PayrollService, PayslipQueueService, PayslipRenderService, S3StorageService],
  exports: [PayrollService]
})
export class PayrollModule {}
