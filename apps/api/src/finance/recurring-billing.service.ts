import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { DB, type Database } from '../db/db.module.js'
import {
  generateMonthlyInvoices,
  type GenerateMonthlyInvoicesResult,
} from './recurring-billing.logic.js'

export type { GenerateMonthlyInvoicesResult }

@Injectable()
export class RecurringBillingService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async generate(
    tenantId: string,
    actorUserId: string | null,
    input: { academicYearId: string; billingMonth: string; gradeId?: string | null },
  ): Promise<GenerateMonthlyInvoicesResult> {
    const billingMonth = input.billingMonth.trim()
    if (!/^\d{4}-\d{2}$/.test(billingMonth)) {
      throw new BadRequestException('billingMonth must be in YYYY-MM format')
    }

    return generateMonthlyInvoices(this.db, {
      tenantId,
      academicYearId: input.academicYearId,
      billingMonth,
      actorUserId,
      gradeId: input.gradeId ?? null,
    })
  }
}
