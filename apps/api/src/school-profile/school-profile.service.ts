import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  StreamableFile
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { tenantSettings, tenants } from "../db/schema.js";
import { S3StorageService } from "../storage/s3-storage.service.js";
import type { UpdateSchoolProfileDto, UpdateTenantPreferencesDto } from "./dto.js";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const ALLOWED_LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function logoStorageKey(tenantId: string): string {
  return `tenants/${tenantId}/settings/logo`;
}

type UploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class SchoolProfileService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: S3StorageService,
    private readonly auditService: AuditService
  ) {}

  async getProfile(tenantId: string) {
    const settings = await this.getSettingsOrThrow(tenantId);

    return {
      schoolName: settings.schoolName,
      schoolType: settings.schoolType,
      motto: settings.motto,
      address: settings.address,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
      principalName: settings.principalName,
      registrationNumber: settings.registrationNumber,
      establishedYear: settings.establishedYear,
      logoFileId: settings.logoFileId
    };
  }

  async updateProfile(tenantId: string, actorUserId: string | undefined, dto: UpdateSchoolProfileDto) {
    const before = await this.getSettingsOrThrow(tenantId);

    await this.db
      .update(tenantSettings)
      .set({
        schoolName: dto.schoolName,
        schoolType: dto.schoolType ?? null,
        motto: dto.motto ?? null,
        address: dto.address ?? null,
        contactEmail: dto.contactEmail ?? null,
        contactPhone: dto.contactPhone ?? null,
        principalName: dto.principalName ?? null,
        registrationNumber: dto.registrationNumber ?? null,
        establishedYear: dto.establishedYear ?? null,
        updatedBy: actorUserId ?? null,
        updatedAt: new Date()
      })
      .where(eq(tenantSettings.tenantId, tenantId));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "tenant.school_profile.update",
      recordType: "TenantSettings",
      recordId: before.id,
      before: {
        schoolName: before.schoolName,
        schoolType: before.schoolType,
        motto: before.motto,
        address: before.address,
        contactEmail: before.contactEmail,
        contactPhone: before.contactPhone,
        principalName: before.principalName,
        registrationNumber: before.registrationNumber,
        establishedYear: before.establishedYear
      },
      after: { ...dto }
    });

    return this.getProfile(tenantId);
  }

  async uploadLogo(tenantId: string, actorUserId: string | undefined, file: UploadFile) {
    const settings = await this.getSettingsOrThrow(tenantId);

    if (!file?.buffer?.length) {
      throw new BadRequestException("No file uploaded.");
    }
    if (file.size > MAX_LOGO_BYTES) {
      throw new BadRequestException("Logo exceeds the 2 MB limit.");
    }
    if (!ALLOWED_LOGO_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException("Logo must be a PNG, JPEG, or WebP image.");
    }

    await this.storage.putObject(logoStorageKey(tenantId), file.buffer, file.mimetype);

    // New fileId on every upload so clients can cache-bust the logo URL.
    const logoFileId = randomUUID();
    await this.db
      .update(tenantSettings)
      .set({
        logoFileId,
        logoMimeType: file.mimetype,
        updatedBy: actorUserId ?? null,
        updatedAt: new Date()
      })
      .where(eq(tenantSettings.tenantId, tenantId));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "tenant.school_logo.upload",
      recordType: "TenantSettings",
      recordId: settings.id,
      after: { mimeType: file.mimetype, sizeBytes: file.size }
    });

    return { logoFileId };
  }

  async getLogo(tenantId: string): Promise<StreamableFile> {
    const settings = await this.getSettingsOrThrow(tenantId);

    if (!settings.logoFileId) {
      throw new NotFoundException("No logo uploaded.");
    }

    const buffer = await this.storage.getObjectIfExists(logoStorageKey(tenantId));
    if (!buffer) {
      throw new NotFoundException("No logo uploaded.");
    }

    return new StreamableFile(buffer, {
      type: settings.logoMimeType ?? "image/png",
      disposition: "inline"
    });
  }

  async deleteLogo(tenantId: string, actorUserId: string | undefined) {
    const settings = await this.getSettingsOrThrow(tenantId);

    await this.db
      .update(tenantSettings)
      .set({
        logoFileId: null,
        logoMimeType: null,
        updatedBy: actorUserId ?? null,
        updatedAt: new Date()
      })
      .where(eq(tenantSettings.tenantId, tenantId));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "tenant.school_logo.delete",
      recordType: "TenantSettings",
      recordId: settings.id,
      before: { logoFileId: settings.logoFileId }
    });

    return { ok: true };
  }

  async getPreferences(tenantId: string) {
    const [tenant] = await this.db
      .select({
        timezone: tenants.timezone,
        defaultLanguage: tenants.defaultLanguage,
        currency: tenants.currency
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    if (!tenant) {
      throw new NotFoundException("Tenant not found.");
    }

    const settings = await this.getSettingsOrThrow(tenantId);

    return {
      defaultLanguage: tenant.defaultLanguage,
      currency: tenant.currency,
      timezone: tenant.timezone,
      dateFormat: settings.dateFormat,
      timeFormat: settings.timeFormat
    };
  }

  async updatePreferences(
    tenantId: string,
    actorUserId: string | undefined,
    dto: UpdateTenantPreferencesDto
  ) {
    const before = await this.getPreferences(tenantId);

    await this.db
      .update(tenants)
      .set({
        defaultLanguage: dto.defaultLanguage,
        currency: dto.currency.toUpperCase(),
        timezone: dto.timezone,
        updatedAt: new Date()
      })
      .where(eq(tenants.id, tenantId));

    await this.db
      .update(tenantSettings)
      .set({
        dateFormat: dto.dateFormat,
        timeFormat: dto.timeFormat,
        updatedBy: actorUserId ?? null,
        updatedAt: new Date()
      })
      .where(eq(tenantSettings.tenantId, tenantId));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "tenant.preferences.update",
      recordType: "Tenant",
      recordId: tenantId,
      before,
      after: { ...dto, currency: dto.currency.toUpperCase() }
    });

    return this.getPreferences(tenantId);
  }

  private async getSettingsOrThrow(tenantId: string) {
    const [settings] = await this.db
      .select()
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId));

    if (!settings) {
      throw new NotFoundException("Tenant settings not found.");
    }

    return settings;
  }
}
