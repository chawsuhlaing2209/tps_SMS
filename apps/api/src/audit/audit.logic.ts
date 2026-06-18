import { auditEventSchema } from '@sms/shared'
import type { z } from 'zod'
import type { Database } from '../db/db.module.js'
import { auditLogs } from '../db/schema.js'

type AuditEventInput = z.input<typeof auditEventSchema> & {
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
}

export async function recordAuditEvent(db: Database, input: AuditEventInput) {
  const parsed = auditEventSchema.parse(input)

  await db.insert(auditLogs).values({
    tenantId: parsed.tenantId,
    actorUserId: parsed.actorUserId,
    action: parsed.action,
    recordType: parsed.recordType,
    recordId: parsed.recordId,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: parsed.reason ?? null,
  })
}
