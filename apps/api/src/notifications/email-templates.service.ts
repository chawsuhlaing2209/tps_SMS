import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, gte, lte } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import { emailTemplates, notificationLogs } from "../db/schema.js";
import type { CreateEmailTemplateDto, UpdateEmailTemplateDto, ListNotificationLogsDto } from "./dto.js";

@Injectable()
export class EmailTemplatesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  listEmailTemplates(tenantId: string) {
    return this.db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.tenantId, tenantId))
      .orderBy(emailTemplates.key);
  }

  async createEmailTemplate(tenantId: string, dto: CreateEmailTemplateDto, userId: string) {
    const rows = await this.db
      .insert(emailTemplates)
      .values({
        tenantId,
        key: dto.key,
        language: dto.language as typeof emailTemplates.language._.data,
        subject: dto.subject,
        body: dto.body,
        createdBy: userId,
        updatedBy: userId
      })
      .returning();
    const row = rows[0]!;
    return row;
  }

  async updateEmailTemplate(tenantId: string, templateId: string, dto: UpdateEmailTemplateDto, userId: string) {
    const [existing] = await this.db
      .select()
      .from(emailTemplates)
      .where(and(eq(emailTemplates.tenantId, tenantId), eq(emailTemplates.id, templateId)));

    if (!existing) {
      throw new NotFoundException("Email template not found.");
    }

    const rows = await this.db
      .update(emailTemplates)
      .set({
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.body !== undefined && { body: dto.body }),
        ...(dto.status !== undefined && { status: dto.status as typeof emailTemplates.status._.data }),
        updatedBy: userId
      })
      .where(and(eq(emailTemplates.tenantId, tenantId), eq(emailTemplates.id, templateId)))
      .returning();
    const row = rows[0]!;
    return row;
  }

  listNotificationLogs(tenantId: string, query: ListNotificationLogsDto) {
    const conditions = [eq(notificationLogs.tenantId, tenantId)];

    if (query.status) {
      conditions.push(eq(notificationLogs.status, query.status));
    }
    if (query.recipientEmail) {
      conditions.push(eq(notificationLogs.recipient, query.recipientEmail));
    }
    if (query.dateFrom) {
      conditions.push(gte(notificationLogs.createdAt, new Date(query.dateFrom)));
    }
    if (query.dateTo) {
      conditions.push(lte(notificationLogs.createdAt, new Date(query.dateTo)));
    }

    return this.db
      .select()
      .from(notificationLogs)
      .where(and(...conditions))
      .orderBy(notificationLogs.createdAt)
      .limit(100);
  }

  async resendNotification(tenantId: string, logId: string, userId: string) {
    const [existing] = await this.db
      .select()
      .from(notificationLogs)
      .where(and(eq(notificationLogs.tenantId, tenantId), eq(notificationLogs.id, logId)));

    if (!existing) {
      throw new NotFoundException("Notification log not found.");
    }

    const rows = await this.db
      .update(notificationLogs)
      .set({
        status: "queued",
        updatedBy: userId
      })
      .where(and(eq(notificationLogs.tenantId, tenantId), eq(notificationLogs.id, logId)))
      .returning();
    const row = rows[0]!;
    return row;
  }
}
