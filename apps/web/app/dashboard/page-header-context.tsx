"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { DASHBOARD_NAV_GROUPS, type DashboardNavGroupKey } from "../lib/permissions";

export type PageBreadcrumb = { label: string; href?: string };

export type PageHeaderValue = {
  title: string;
  breadcrumbs: PageBreadcrumb[];
  backHref?: string;
  description?: string;
};

type StoredHeader = PageHeaderValue & { pathname: string };

type PageHeaderContextType = {
  header: StoredHeader | null;
  setHeader: (value: StoredHeader | null) => void;
};

const PageHeaderContext = createContext<PageHeaderContextType | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<StoredHeader | null>(null);
  const value = useMemo(() => ({ header, setHeader }), [header]);
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

function usePageHeaderContext(): PageHeaderContextType {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) {
    throw new Error("usePageHeaderContext must be used within a PageHeaderProvider");
  }
  return ctx;
}

/**
 * Rendered by individual pages to publish their title/breadcrumbs to the top
 * bar. Renders nothing in the body unless `backHref` is provided, in which case
 * it renders the "← Back to …" link directly under the top bar.
 */
export function PageHeader({
  title,
  breadcrumbs = [],
  backHref,
  backLabel,
  description
}: {
  title: string;
  breadcrumbs?: PageBreadcrumb[];
  backHref?: string;
  backLabel?: string;
  /** Optional muted line rendered directly under the title in the top bar. */
  description?: string;
}) {
  const { setHeader } = usePageHeaderContext();
  const pathname = usePathname();
  const crumbKey = breadcrumbs.map((c) => `${c.label}:${c.href ?? ""}`).join("|");

  useEffect(() => {
    setHeader({ pathname, title, breadcrumbs, backHref, description });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, title, crumbKey, backHref, description]);

  if (backHref) {
    return (
      <Link href={backHref} className="page-back-link">
        <span aria-hidden>←</span>
        {backLabel ?? title}
      </Link>
    );
  }
  return null;
}

/**
 * Derives a sensible top-bar title + breadcrumb from the current pathname using
 * the dashboard nav config, so unmigrated pages still get a correct header.
 */
/**
 * Maps a dashboard nav key to its authored page-description message key, so the
 * top bar can render a muted description line stacked under the title even on
 * pages that rely on the route-based header fallback.
 */
const NAV_DESCRIPTION_KEY: Record<string, string> = {
  overview: "overview.description",
  people: "people.description",
  structure: "academics.description",
  academicSetup: "academicSetup.description",
  admissions: "admissions.description",
  enrollments: "enrollments.description",
  calendar: "calendar.description",
  timetable: "timetable.description",
  exams: "exams.description",
  finance: "finance.description",
  salary: "salary.description",
  communication: "communication.description",
    audit: "audit.description",
    settings: "settings.description"
  };

function useRouteHeaderFallback(): PageHeaderValue {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tRoot = useTranslations();

  return useMemo(() => {
    const describe = (navKey: string): string | undefined => {
      const key = NAV_DESCRIPTION_KEY[navKey];
      return key ? tRoot(key as "overview.description") : undefined;
    };

    if (pathname === "/dashboard" || pathname === "/dashboard/") {
      return { title: t("overview"), breadcrumbs: [], description: describe("overview") };
    }

    let best: { groupKey: DashboardNavGroupKey; navKey: string; href: string } | null = null;
    for (const group of DASHBOARD_NAV_GROUPS) {
      for (const item of group.items) {
        if (item.href === "/dashboard") {
          continue;
        }
        if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
          if (!best || item.href.length > best.href.length) {
            best = { groupKey: group.key, navKey: item.key, href: item.href };
          }
        }
      }
    }

    if (!best) {
      return { title: t("overview"), breadcrumbs: [], description: describe("overview") };
    }

    return {
      title: t(best.navKey as "overview"),
      breadcrumbs: [{ label: t(`group_${best.groupKey}` as "group_school") }],
      description: describe(best.navKey)
    };
  }, [pathname, t, tRoot]);
}

/**
 * Read the resolved header for the current route: the explicit value published
 * by the active page if it matches the current pathname, otherwise the
 * route-based fallback. Consumed by the top bar.
 */
export function useResolvedPageHeader(): PageHeaderValue {
  const { header } = usePageHeaderContext();
  const pathname = usePathname();
  const fallback = useRouteHeaderFallback();

  if (header && header.pathname === pathname) {
    return {
      title: header.title,
      breadcrumbs: header.breadcrumbs,
      backHref: header.backHref,
      description: header.description
    };
  }
  return fallback;
}
