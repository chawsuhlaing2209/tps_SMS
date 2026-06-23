import type { RoleDisplayMeta } from "@sms/shared";

/** Localized role label for UI; falls back to custom name or English seed label. */
export function localizedRoleLabel(
  display: RoleDisplayMeta,
  tNames: (key: string) => string,
  fallbackName?: string
): string {
  if (display.labelKey) {
    return tNames(display.labelKey);
  }
  return fallbackName?.trim() || display.label;
}
