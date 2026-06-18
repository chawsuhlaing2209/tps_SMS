import { Module } from '@nestjs/common'
import { DbModule } from '../db/db.module.js'
import { AuditModule } from '../audit/audit.module.js'
import { AuthzModule } from '../identity/authz.module.js'
import { NotificationsModule } from '../notifications/notifications.module.js'
import { FinanceController } from './finance.controller.js'
import { FinanceService } from './finance.service.js'
import { InvoicesQueueService } from './invoices-queue.service.js'
import { RecurringBillingService } from './recurring-billing.service.js'

@Module({
  imports: [DbModule, AuditModule, AuthzModule, NotificationsModule],
  controllers: [FinanceController],
  providers: [FinanceService, RecurringBillingService, InvoicesQueueService],
  exports: [FinanceService, RecurringBillingService],
})
export class FinanceModule {}
