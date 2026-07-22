import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "./data-table";
import { useMediaQuery } from "./use-media-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

// Note: vi.unstubAllGlobals() would also remove the ResizeObserver polyfill
// from vitest.setup.ts, so each test simply re-stubs matchMedia.
function mockMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
  );
}

function wrap(ui: ReactNode) {
  // DataTable formats "Last updated" through useTenantFormats, which reads
  // tenant preferences via react-query — the render needs a QueryClient.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider
        locale="en"
        messages={{ common: { lastUpdated: "Last updated", openRecord: "Open record" } }}
      >
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

type Row = { name: string; updatedAt: string };

const columns = [{ id: "name", header: "Name", accessorKey: "name" }];
const rows: Row[] = [{ name: "Mg Mg", updatedAt: "2026-01-01T00:00:00Z" }];

describe("useMediaQuery", () => {
  it("reflects matchMedia state", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery("(max-width: 719.98px)"));
    expect(result.current).toBe(true);
  });

  it("is false when the query does not match", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery("(max-width: 719.98px)"));
    expect(result.current).toBe(false);
  });
});

describe("DataTable mobileItem", () => {
  it("renders the card list instead of a table below the md breakpoint", () => {
    mockMatchMedia(true);
    wrap(
      <DataTable<Row>
        columns={columns}
        data={rows}
        onRowClick={() => {}}
        mobileItem={{ title: (row) => row.name, meta: (row) => row.updatedAt }}
      />
    );

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("Mg Mg").closest(".pds-entity-list-item")).not.toBeNull();
  });

  it("keeps the table on desktop even when mobileItem is provided", () => {
    mockMatchMedia(false);
    wrap(
      <DataTable<Row>
        columns={columns}
        data={rows}
        mobileItem={{ title: (row) => row.name }}
      />
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("falls back to the table without mobileItem, even on mobile", () => {
    mockMatchMedia(true);
    wrap(<DataTable<Row> columns={columns} data={rows} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});
