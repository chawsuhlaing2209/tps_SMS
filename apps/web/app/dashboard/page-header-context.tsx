"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  registerNavigationSegment,
  resetNavigationTrail,
  readNavigationTrail,
  type NavigationSegment
} from "../lib/navigation-trail";
import { DASHBOARD_NAV_GROUPS, type DashboardNavGroupKey } from "../lib/permissions";

export type PageBreadcrumb = { label: string; href?: string };

export type PageHeaderValue = {
  title: string;
  breadcrumbs: PageBreadcrumb[];
  description?: string;
  actions?: ReactNode;
  /** Reserve the title-row actions slot for a client portal (context-aware CTAs). */
  actionsPortal?: boolean;
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
 * Publishes page metadata to the in-body chrome (breadcrumb bar + title row).
 * Navigation is via breadcrumbs only — no in-page back links.
 */
export function PageHeader({
  title,
  breadcrumbs = [],
  description,
  actions,
  actionsPortal,
  segment,
  resetTrail
}: {
  title: string;
  breadcrumbs?: PageBreadcrumb[];
  description?: string;
  actions?: ReactNode;
  actionsPortal?: boolean;
  segment?: NavigationSegment;
  resetTrail?: NavigationSegment[];
}) {
  const { setHeader } = usePageHeaderContext();
  const pathname = usePathname();
  const resolvedSegment = segment ?? { label: title, href: pathname };
  const resetTrailKey = resetTrail?.map((item) => `${item.label}:${item.href}`).join("|") ?? "";
  const crumbKey = breadcrumbs.map((c) => `${c.label}:${c.href ?? ""}`).join("|");

  useEffect(() => {
    if (resetTrail?.length) {
      resetNavigationTrail(resetTrail);
    }

    registerNavigationSegment(resolvedSegment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, resolvedSegment.label, resolvedSegment.href, resetTrailKey]);

  useEffect(() => {
    setHeader({
      pathname,
      title,
      breadcrumbs,
      description,
      actions,
      actionsPortal
    });
  }, [pathname, title, crumbKey, description, actions, actionsPortal, setHeader]);

  return null;
}

function useRouteHeaderFallback(): PageHeaderValue {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return useMemo(() => {
    if (pathname === "/dashboard" || pathname === "/dashboard/") {
      return { title: t("overview"), breadcrumbs: [] };
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
      return { title: t("overview"), breadcrumbs: [] };
    }

    return {
      title: t(best.navKey as "overview"),
      breadcrumbs: [{ label: t(`group_${best.groupKey}` as "group_school") }]
    };
  }, [pathname, t]);
}

export function useResolvedPageHeader(): PageHeaderValue {
  const { header } = usePageHeaderContext();
  const pathname = usePathname();
  const fallback = useRouteHeaderFallback();
  const trail = useNavigationTrailForHeader();

  if (header && header.pathname === pathname) {
    const breadcrumbs =
      header.breadcrumbs.length > 0
        ? header.breadcrumbs
        : trail.length > 0
          ? trail.map((item) => ({ label: item.label, href: item.href }))
          : header.breadcrumbs;

    return {
      title: header.title,
      breadcrumbs,
      description: header.description,
      actions: header.actions,
      actionsPortal: header.actionsPortal
    };
  }
  return fallback;
}

function useNavigationTrailForHeader(): NavigationSegment[] {
  const pathname = usePathname();
  const [trail, setTrail] = useState<NavigationSegment[]>([]);

  useEffect(() => {
    const sync = () => setTrail(readNavigationTrail());
    sync();
    window.addEventListener("sms-navigation-trail-change", sync);
    return () => window.removeEventListener("sms-navigation-trail-change", sync);
  }, [pathname]);

  return trail;
}
