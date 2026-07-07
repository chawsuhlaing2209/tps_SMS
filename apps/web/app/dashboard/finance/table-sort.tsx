"use client";

import { useCallback, useState, type ReactNode } from "react";

export type SortDirection = "asc" | "desc";

export function sortDirectionIndicator(direction: SortDirection | null): string {
  if (direction === "asc") return " ↑";
  if (direction === "desc") return " ↓";
  return "";
}

type UsePadaukSortOptions<K extends string> = {
  defaultKey: K;
  defaultDir: SortDirection;
  initialDir?: Partial<Record<K, SortDirection>>;
};

export function usePadaukSort<K extends string>({
  defaultKey,
  defaultDir,
  initialDir = {}
}: UsePadaukSortOptions<K>) {
  const [sortKey, setSortKey] = useState<K>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDirection>(defaultDir);

  const toggleSort = useCallback(
    (key: K) => {
      if (key === sortKey) {
        setSortDir((current) => (current === "asc" ? "desc" : "asc"));
        return;
      }
      setSortKey(key);
      setSortDir(initialDir[key] ?? defaultDir);
    },
    [defaultDir, initialDir, sortKey]
  );

  return { sortKey, sortDir, toggleSort };
}

export function PadaukSortHeader({
  label,
  active,
  direction,
  onClick,
  className
}: {
  label: ReactNode;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className ? `pds-type-caption-s table-sort ${className}` : "pds-type-caption-s table-sort"}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      onClick={onClick}
    >
      {label}
      {active ? sortDirectionIndicator(direction) : null}
    </button>
  );
}
