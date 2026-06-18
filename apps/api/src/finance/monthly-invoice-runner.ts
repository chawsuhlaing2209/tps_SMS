import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../db/schema.js'
import { generateMonthlyInvoices } from './recurring-billing.logic.js'

export type MonthlyInvoiceJobData = {
  tenantId: string
  academicYearId: string
  billingMonth: string
  triggeredByUserId: string | null
}

export async function runMonthlyInvoiceJob(data: MonthlyInvoiceJobData) {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run generate-monthly-invoices')
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool, { schema })

  try {
    return await generateMonthlyInvoices(db, {
      tenantId: data.tenantId,
      academicYearId: data.academicYearId,
      billingMonth: data.billingMonth,
      actorUserId: data.triggeredByUserId,
    })
  } finally {
    await pool.end()
  }
}
