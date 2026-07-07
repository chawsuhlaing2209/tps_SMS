import { apiFetch } from "./api";
import { getSession } from "./session";

export type CsvColumn = {
  key: string;
  header: string;
};

export type CsvRow = Record<string, string | number | null | undefined>;

/** RFC 4180-style field escaping for CSV download. */
export function escapeCsvField(value: unknown): string {
  if (value == null) {
    return "";
  }
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvContent(columns: CsvColumn[], rows: CsvRow[]): string {
  const header = columns.map((column) => escapeCsvField(column.header)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvField(row[column.key])).join(",")
  );
  return [header, ...body].join("\n");
}

/** Trigger a browser download for CSV text content. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export const EXPORT_PAGE_SIZE = 200;

type PaginatedParseResult<T> = {
  rows: T[];
  total: number;
};

/**
 * Fetch all rows for a paginated tenant API, respecting server page caps.
 */
export async function fetchAllPaginated<T>(
  buildPath: (limit: number, offset: number) => string,
  parse: (json: unknown) => PaginatedParseResult<T>,
  pageSize = EXPORT_PAGE_SIZE
): Promise<T[]> {
  const tenantId = getSession()?.tenantId;
  if (!tenantId) {
    throw new Error("Not signed in.");
  }

  const all: T[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const data = await apiFetch<unknown>(buildPath(pageSize, offset));
    const { rows, total: nextTotal } = parse(data);
    total = nextTotal;
    all.push(...rows);
    if (!rows.length) {
      break;
    }
    offset += rows.length;
  }

  return all;
}

/** Build a multi-section CSV (section title row + table per block). */
export function buildSectionedCsv(
  sections: Array<{ title: string; columns: CsvColumn[]; rows: CsvRow[] }>
): string {
  const parts: string[] = [];

  for (const section of sections) {
    if (parts.length) {
      parts.push("");
    }
    parts.push(escapeCsvField(section.title));
    parts.push(buildCsvContent(section.columns, section.rows));
  }

  return parts.join("\n");
}
