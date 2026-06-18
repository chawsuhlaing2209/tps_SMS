/** Compact grade badge label (KG, G1, G5, …) for setup tables. */
export function gradeBadgeLabel(name: string): string {
  const trimmed = name.trim();
  if (/^kg$/i.test(trimmed)) return "KG";
  const match = trimmed.match(/grade\s*(\d+)/i);
  if (match) return `G${match[1]}`;
  if (trimmed.length <= 4) return trimmed;
  return trimmed.replace(/\s+/g, "").slice(0, 3);
}

/** Optional stream subtitle from age range (e.g. early years). */
export function gradeStreamLabel(minAge: number | null, maxAge: number | null): string | null {
  if (minAge == null && maxAge == null) return null;
  if (maxAge != null && maxAge <= 6) return "Early Years stream";
  if (minAge != null && minAge >= 15) return "Upper secondary stream";
  if (minAge != null && minAge >= 11) return "Secondary stream";
  if (minAge != null && minAge >= 6) return "Primary stream";
  return null;
}
