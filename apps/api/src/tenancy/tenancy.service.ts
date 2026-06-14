import { Injectable } from "@nestjs/common";
import { tenantSlugSchema } from "@sms/shared";
import type { TenantResolutionInput } from "./tenant-context.js";

@Injectable()
export class TenancyService {
  resolveSlug(input: TenantResolutionInput): string | null {
    if (input.tenantSlug) {
      return tenantSlugSchema.parse(input.tenantSlug);
    }

    if (input.schoolCode) {
      return tenantSlugSchema.parse(input.schoolCode.toLowerCase());
    }

    const host = input.host?.split(":")[0];
    const subdomain = host?.split(".")[0];
    if (!subdomain || ["localhost", "www", "app"].includes(subdomain)) {
      return null;
    }

    return tenantSlugSchema.parse(subdomain);
  }

  tenantFilePath(tenantId: string, segments: string[]): string {
    const safeSegments = segments.map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, "-"));
    return ["tenants", tenantId, ...safeSegments].join("/");
  }
}
