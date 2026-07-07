"use client";

import { useReferenceApiQuery } from "./api";

export type SchoolBrand = {
  schoolName: string | null;
  logoFileId: string | null;
};

/** Path invalidated by the school-profile settings page after name/logo changes. */
export const SCHOOL_BRAND_PATH = (tenantId: string) =>
  `/tenants/${tenantId}/dashboard/school-brand`;

/**
 * Tenant brand (school name + logo) for the sidebar and customer-facing
 * documents. `logoUrl` is null until a logo has been uploaded; the
 * `logoFileId` query param cache-busts stale browser caches after re-upload.
 */
export function useSchoolBrand() {
  const query = useReferenceApiQuery<SchoolBrand>(SCHOOL_BRAND_PATH);
  const logoUrl =
    query.tenantId && query.data?.logoFileId
      ? `/api/tenants/${query.tenantId}/settings/school-profile/logo?v=${query.data.logoFileId}`
      : null;

  return { ...query, logoUrl };
}
