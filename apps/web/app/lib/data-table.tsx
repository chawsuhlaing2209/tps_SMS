"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type SortingState
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { appendNavigationTrail, type NavigationSegment } from "./navigation-trail";
import { subjectColor } from "../dashboard/structure/subject-colors";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../../components/ui/table";

type TimestampRow = {
  updatedAt?: string | null;
  createdAt?: string | null;
};

const STATUS_RANK: Record<string, number> = {
  active: 0,
  enrolled: 0,
  draft: 1,
  invited: 1,
  probation: 1,
  inactive: 2,
  suspended: 2,
  transferred: 2,
  withdrawn: 2,
  archived: 99,
  graduated: 99,
  closed: 99
};

function statusRank(value: unknown): number {
  if (typeof value !== "string") {
    return 50;
  }
  return STATUS_RANK[value] ?? 50;
}

const statusSortingFn = <TData,>(
  rowA: Row<TData>,
  rowB: Row<TData>,
  columnId: string
) => statusRank(rowA.getValue(columnId)) - statusRank(rowB.getValue(columnId));

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

function columnHasStatus<TData>(column: ColumnDef<TData, unknown>): boolean {
  return column.id === "status" || ("accessorKey" in column && column.accessorKey === "status");
}

export function computeDefaultSorting<TData>(
  columns: ColumnDef<TData, unknown>[],
  showUpdatedAt: boolean
): SortingState {
  if (
    showUpdatedAt &&
    (columns.some((column) => column.id === "updatedAt") || showUpdatedAt)
  ) {
    return [{ id: "updatedAt", desc: true }];
  }

  const hasStatus = columns.some(columnHasStatus);
  if (hasStatus) {
    return [{ id: "status", desc: false }];
  }

  return [];
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
  const enhanced = columns.map((column) => {
    const next: ColumnDef<TData, unknown> = {
      ...column,
      enableSorting: columnIsSortable(column)
    };

    if (columnHasStatus(column)) {
      next.id = column.id ?? "status";
      next.sortingFn = statusSortingFn;
      next.enableSorting = true;
    }

    return next;
  });

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

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest("button, a, input, select, textarea, label, [data-row-stop]"));
}

export function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/** Avatar + name + optional email/subtitle for directory tables. */
export function DirectoryMemberCell({
  name,
  email,
  subtitle,
  colorKey
}: {
  name: string;
  email?: string | null;
  subtitle?: ReactNode;
  /** Hash key for avatar tint; defaults to `name`. */
  colorKey?: string;
}) {
  const swatch = subjectColor(colorKey ?? name);
  const meta = email ?? subtitle;

  return (
    <span className="directory-member">
      <span
        className="directory-avatar"
        style={{ background: swatch.bg, color: swatch.text }}
        aria-hidden
      >
        {deriveInitials(name)}
      </span>
      <span className="directory-member__text">
        <span className="directory-member__name">{name}</span>
        {meta ? <span className="directory-member__meta">{meta}</span> : null}
      </span>
    </span>
  );
}

/** @deprecated Prefer {@link DirectoryMemberCell} for new directory tables. */
export function DirectoryNameCell({
  name,
  avatar
}: {
  name: string;
  avatar?: ReactNode;
}) {
  if (avatar) {
    return (
      <span className="directory-member">
        {avatar}
        <span className="directory-member__text">
          <span className="directory-member__name">{name}</span>
        </span>
      </span>
    );
  }

  return <DirectoryMemberCell name={name} />;
}

/**
 * Sortable table wrapper. Appends a "Last updated" column by default and sorts
 * active records first, then newest by last updated unless overridden.
 */
export function DataTable<TData>({
  columns,
  data,
  showUpdatedAt = true,
  updatedAtLabel,
  initialSorting,
  getRowHref,
  onRowClick,
  navigationFrom
}: {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  showUpdatedAt?: boolean;
  updatedAtLabel?: string;
  initialSorting?: SortingState;
  getRowHref?: (row: TData) => string | null | undefined;
  onRowClick?: (row: TData) => void;
  /** Current list page appended to the trail before row navigation. */
  navigationFrom?: NavigationSegment;
}) {
  const c = useTranslations("common");
  const router = useRouter();
  const resolvedUpdatedAtLabel = updatedAtLabel ?? c("lastUpdated");
  const resolvedInitialSorting =
    initialSorting ?? computeDefaultSorting(columns, showUpdatedAt);
  const [sorting, setSorting] = useState<SortingState>(resolvedInitialSorting);
  const rowIsInteractive = Boolean(getRowHref || onRowClick);

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

  const activateRow = (row: TData) => {
    if (getRowHref) {
      const href = getRowHref(row);
      if (href) {
        if (navigationFrom) {
          appendNavigationTrail(navigationFrom);
        }
        router.push(href);
      }
      return;
    }

    onRowClick?.(row);
  };

  const handleRowClick = (row: TData, event: MouseEvent<HTMLTableRowElement>) => {
    if (isInteractiveTarget(event.target)) {
      return;
    }

    activateRow(row);
  };

  const handleRowKeyDown = (row: TData, event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    activateRow(row);
  };

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const canSort = header.column.getCanSort();
              return (
                <TableHead key={header.id}>
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
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row: Row<TData>) => {
          const href = getRowHref?.(row.original);
          const clickable = rowIsInteractive && (onRowClick || href);

          return (
            <TableRow
              key={row.id}
              className={clickable ? "table-row--clickable" : undefined}
              tabIndex={clickable ? 0 : undefined}
              role={clickable ? "link" : undefined}
              aria-label={clickable && href ? c("openRecord") : undefined}
              onClick={clickable ? (event) => handleRowClick(row.original, event) : undefined}
              onKeyDown={
                clickable ? (event) => handleRowKeyDown(row.original, event) : undefined
              }
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
