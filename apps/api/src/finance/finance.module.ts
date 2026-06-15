import { Module } from '@nestjs/common'
import { DbModule } from '../db/db.module.js'
import { AuditModule } from '../audit/audit.module.js'
import { AuthzModule } from '../identity/authz.module.js'
import { FinanceController } from './finance.controller.js'
import { FinanceService } from './finance.service.js'

@Module({
  imports: [DbModule, AuditModule, AuthzModule],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
