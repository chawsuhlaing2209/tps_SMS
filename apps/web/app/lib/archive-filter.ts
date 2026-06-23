export type ArchiveVisibility = "active" | "archived" | "all";

export function isArchivedRecord(status: string): boolean {
  return status === "archived";
}

export function filterByArchiveVisibility<T extends { status: string }>(
  items: T[],
  visibility: ArchiveVisibility
): T[] {
  if (visibility === "all") {
    return items;
  }
  if (visibility === "archived") {
    return items.filter((item) => isArchivedRecord(item.status));
  }
  return items.filter((item) => !isArchivedRecord(item.status));
}
