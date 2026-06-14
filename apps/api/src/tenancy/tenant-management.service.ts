import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { featureFlags, tenantSettings, tenants } from "../db/schema.js";
import type {
  CreateTenantDto,
  SetFeatureFlagDto,
  UpdateTenantStatusDto,
  UpsertTenantSettingsDto
} from "./dto.js";

@Injectable()
export class TenantManagementService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  listTenants() {
    return this.db.select().from(tenants).orderBy(tenants.name);
  }

  async createTenant(dto: CreateTenantDto, actorUserId?: string) {
    const [tenant] = await this.db
      .insert(tenants)
      .values({
        name: dto.name,
        slug: dto.slug,
        timezone: dto.timezone ?? "Asia/Yangon",
        defaultLanguage: dto.defaultLanguage ?? "en",
        currency: dto.currency ?? "MMK"
      })
      .returning();

    if (tenant) {
      await this.auditService.recordEvent({
        tenantId: tenant.id,
        actorUserId: actorUserId ?? null,
        action: "tenant.create",
        recordType: "Tenant",
        recordId: tenant.id,
        after: { name: tenant.name, slug: tenant.slug, status: tenant.status }
      });
    }

    return tenant;
  }

  async updateTenantStatus(tenantId: string, dto: UpdateTenantStatusDto, actorUserId?: string) {
    const [previous] = await this.db.select().from(tenants).where(eq(tenants.id, tenantId));

    if (!previous) {
      throw new NotFoundException("Tenant not found.");
    }

    const [tenant] = await this.db
      .update(tenants)
      .set({
        status: dto.status,
        updatedAt: new Date()
      })
      .where(eq(tenants.id, tenantId))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "tenant.status.update",
      recordType: "Tenant",
      recordId: tenantId,
      before: { status: previous.status },
      after: { status: dto.status }
    });

    return tenant;
  }

  async getTenantSettings(tenantId: string) {
    const [settings] = await this.db
      .select()
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId));

    if (!settings) {
      throw new NotFoundException("Tenant settings not found.");
    }

    return settings;
  }

  async upsertTenantSettings(tenantId: string, dto: UpsertTenantSettingsDto, actorUserId?: string) {
    const values = {
      tenantId,
      schoolName: dto.schoolName,
      address: dto.address,
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
      receiptPrefix: dto.receiptPrefix ?? "RCPT",
      invoicePrefix: dto.invoicePrefix ?? "INV",
      updatedBy: actorUserId
    };

    const [settings] = await this.db
      .insert(tenantSettings)
      .values({
        ...values,
        createdBy: actorUserId
      })
      .onConflictDoUpdate({
        target: tenantSettings.tenantId,
        set: {
          ...values,
          updatedAt: new Date()
        }
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "tenant.settings.upsert",
      recordType: "TenantSettings",
      recordId: tenantId,
      after: { schoolName: dto.schoolName }
    });

    return settings;
  }

  listFeatureFlags(tenantId: string) {
    return this.db.select().from(featureFlags).where(eq(featureFlags.tenantId, tenantId));
  }

  async setFeatureFlag(tenantId: string, dto: SetFeatureFlagDto, actorUserId?: string) {
    const [flag] = await this.db
      .insert(featureFlags)
      .values({
        tenantId,
        key: dto.key,
        enabled: dto.enabled,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .onConflictDoUpdate({
        target: [featureFlags.tenantId, featureFlags.key],
        set: {
          enabled: dto.enabled,
          updatedBy: actorUserId,
          updatedAt: new Date()
        }
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "tenant.feature_flag.set",
      recordType: "FeatureFlag",
      recordId: `${tenantId}:${dto.key}`,
      after: { key: dto.key, enabled: dto.enabled }
    });

    return flag;
  }
}
