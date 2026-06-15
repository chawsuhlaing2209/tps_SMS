"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

type TimestampRow = {
  updatedAt?: string | null;
  createdAt?: string | null;
};

export function getRowTimestamp(row: unknown): number {
  if (!row || typeof row !== "object") {
    return 0;
  }

  const record = row as TimestampRow;
  const value = record.updatedAt ?? record.createdAt;
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function formatRowTimestamp(row: unknown): string {
  if (!row || typeof row !== "object") {
    return "—";
  }

  const record = row as TimestampRow;
  const value = record.updatedAt ?? record.createdAt;
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

export const DEFAULT_TABLE_SORT: SortingState = [{ id: "updatedAt", desc: true }];

function columnIsSortable<TData>(column: ColumnDef<TData, unknown>): boolean {
  if (column.enableSorting === false) {
    return false;
  }
  if (column.enableSorting === true) {
    return true;
  }
  return "accessorKey" in column || "accessorFn" in column || column.id === "updatedAt";
}

function prepareColumns<TData>(
  columns: ColumnDef<TData, unknown>[],
  updatedAtLabel: string,
  showUpdatedAt: boolean
): ColumnDef<TData, unknown>[] {
  const enhanced = columns.map((column) => ({
    ...column,
    enableSorting: columnIsSortable(column)
  }));

  if (!showUpdatedAt || enhanced.some((column) => column.id === "updatedAt")) {
    return enhanced;
  }

  return [
    ...enhanced,
    {
      id: "updatedAt",
      header: updatedAtLabel,
      accessorFn: (row) => getRowTimestamp(row),
      cell: ({ row }) => formatRowTimestamp(row.original),
      enableSorting: true
    }
  ];
}

function sortIndicator(isSorted: false | "asc" | "desc"): string {
  if (isSorted === "asc") {
    return " ↑";
  }
  if (isSorted === "desc") {
    return " ↓";
  }
  return "";
}

/**
 * Sortable table wrapper. Appends a "Last updated" column by default and sorts
 * newest-first unless another initial sort is provided.
 */
export function DataTable<TData>({
  columns,
  data,
  showUpdatedAt = true,
  updatedAtLabel,
  initialSorting = DEFAULT_TABLE_SORT
}: {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  showUpdatedAt?: boolean;
  updatedAtLabel?: string;
  initialSorting?: SortingState;
}) {
  const c = useTranslations("common");
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const resolvedUpdatedAtLabel = updatedAtLabel ?? c("lastUpdated");

  const tableColumns = useMemo(
    () => prepareColumns(columns, resolvedUpdatedAtLabel, showUpdatedAt),
    [columns, showUpdatedAt, resolvedUpdatedAtLabel]
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <table className="table">
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const canSort = header.column.getCanSort();
              return (
                <th key={header.id}>
                  {header.isPlaceholder ? null : canSort ? (
                    <button
                      type="button"
                      className="table-sort"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sortIndicator(header.column.getIsSorted())}
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
