"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { TenantPreferences } from "@sms/shared";
import { apiFetch, tenantQueryKey } from "./api";
import {
  DEFAULT_TENANT_PREFERENCES,
  formatPreferredDate,
  formatPreferredDateTime,
  formatPreferredMoney,
  formatPreferredMonth,
  formatPreferredTime,
  type DateInput
} from "./format-preferences";
import { getSession } from "./session";

const PREFERENCES_STALE_MS = 5 * 60_000;

type MePreferencesResponse = {
  preferences?: TenantPreferences | null;
};

/**
 * Tenant display preferences from the workspace bootstrap (`/auth/me`).
 * Shares the query cache with useWorkspace, so subscribing here costs no
 * extra request; falls back to the session copy, then platform defaults.
 */
export function useTenantPreferences(): TenantPreferences {
  const session = getSession();
  const tenantId = session?.tenantId ?? null;
  const enabled = Boolean(tenantId && !session?.isPlatform);

  const { data } = useQuery({
    queryKey:
      tenantId && enabled
        ? tenantQueryKey(tenantId, `/tenants/${tenantId}/auth/me`)
        : ["workspace", "anonymous"],
    queryFn: () => apiFetch<MePreferencesResponse>(`/tenants/${tenantId}/auth/me`),
    enabled,
    staleTime: PREFERENCES_STALE_MS,
    retry: false
  });

  return data?.preferences ?? session?.preferences ?? DEFAULT_TENANT_PREFERENCES;
}

export type TenantFormats = {
  preferences: TenantPreferences;
  currency: string;
  formatDate: (value: DateInput) => string;
  formatTime: (value: DateInput) => string;
  formatDateTime: (value: DateInput) => string;
  formatMonth: (value: string | null | undefined) => string;
  formatMoney: (value: number) => string;
};

/** Bound formatters honoring the tenant's date/time/currency preferences. */
export function useTenantFormats(): TenantFormats {
  const preferences = useTenantPreferences();

  return useMemo(
    () => ({
      preferences,
      currency: preferences.currency,
      formatDate: (value: DateInput) => formatPreferredDate(value, preferences),
      formatTime: (value: DateInput) => formatPreferredTime(value, preferences),
      formatDateTime: (value: DateInput) => formatPreferredDateTime(value, preferences),
      formatMonth: (value: string | null | undefined) => formatPreferredMonth(value, preferences),
      formatMoney: (value: number) => formatPreferredMoney(value, preferences)
    }),
    [preferences]
  );
}
