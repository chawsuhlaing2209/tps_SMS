"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { Icon } from "./material-icon";
import type { RowSelectionConfig } from "./data-table";

/** Tracks a set of selected row ids across pages. */
export function useRowSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  return { selected, setSelected, toggle, clear };
}

/** Builds the DataTable rowSelection config from the current page's rows. */
export function buildRowSelection<TData>(
  rows: TData[],
  getId: (row: TData) => string,
  selection: ReturnType<typeof useRowSelection>
): RowSelectionConfig<TData> {
  const ids = rows.map(getId);
  const allSelected = ids.length > 0 && ids.every((id) => selection.selected.has(id));
  const someSelected = ids.some((id) => selection.selected.has(id));
  return {
    getRowId: getId,
    isSelected: (id) => selection.selected.has(id),
    onToggle: selection.toggle,
    allSelected,
    someSelected,
    onToggleAll: (checked) =>
      selection.setSelected((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          if (checked) next.add(id);
          else next.delete(id);
        }
        return next;
      })
  };
}

/** Floating bar shown when rows are selected, offering bulk archive/restore. */
export function BulkArchiveBar({
  count,
  onArchive,
  onRestore,
  onClear,
  busy
}: {
  count: number;
  onArchive?: () => void;
  onRestore?: () => void;
  onClear: () => void;
  busy?: boolean;
}) {
  const c = useTranslations("common");
  const label = useMemo(() => c("selectedCount", { count }), [c, count]);
  if (count === 0) {
    return null;
  }
  return (
    <div className="bulk-action-bar" role="region" aria-label={label}>
      <span className="pds-type-body-s-medium bulk-action-bar__count">{label}</span>
      <div className="bulk-action-bar__actions">
        {onArchive ? (
          <button type="button" className="btn-ghost" onClick={onArchive} disabled={busy}>
            <Icon name="archive" size={16} />
            {c("archive")}
          </button>
        ) : null}
        {onRestore ? (
          <button type="button" className="btn-ghost" onClick={onRestore} disabled={busy}>
            <Icon name="restore" size={16} />
            {c("restore")}
          </button>
        ) : null}
        <button type="button" className="btn-ghost" onClick={onClear} disabled={busy}>
          {c("clearSelection")}
        </button>
      </div>
    </div>
  );
}
