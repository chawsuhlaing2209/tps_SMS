"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
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
  /** When false, hides the in-body title row (e.g. home dashboard hero). Default true. */
  showTitle?: boolean;
};

type StoredHeader = PageHeaderValue & { pathname: string };

type PageHeaderStore = {
  header: StoredHeader | null;
  listeners: Set<() => void>;
};

const PAGE_HEADER_STORE_KEY = "__sms_page_header_store__";

function getPageHeaderStore(): PageHeaderStore {
  const globalRef = globalThis as typeof globalThis & {
    [PAGE_HEADER_STORE_KEY]?: PageHeaderStore;
  };

  if (!globalRef[PAGE_HEADER_STORE_KEY]) {
    globalRef[PAGE_HEADER_STORE_KEY] = {
      header: null,
      listeners: new Set()
    };
  }

  return globalRef[PAGE_HEADER_STORE_KEY];
}

function subscribePageHeader(listener: () => void) {
  const store = getPageHeaderStore();
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

function getPageHeaderSnapshot() {
  return getPageHeaderStore().header;
}

function setPageHeader(value: StoredHeader | null) {
  const store = getPageHeaderStore();
  store.header = value;
  store.listeners.forEach((listener) => listener());
}

function usePageHeaderState() {
  const header = useSyncExternalStore(subscribePageHeader, getPageHeaderSnapshot, () => null);

  return useMemo(
    () => ({
      header,
      setHeader: setPageHeader
    }),
    [header]
  );
}

/** Mount boundary for dashboard chrome; clears published header on unmount. */
export function PageHeaderProvider({ children }: { children: ReactNode }) {
  useEffect(() => () => setPageHeader(null), []);

  return children;
}

/**
 * Publishes page metadata to the in-body chrome (breadcrumb bar + title row).
 * Section descriptions belong in `description` — rendered under the title in
 * {@link DashboardPageTitle}, not as standalone copy in the page body.
 */
export function PageHeader({
  title,
  breadcrumbs = [],
  description,
  actions,
  actionsPortal,
  showTitle = true,
  segment,
  resetTrail
}: {
  title: string;
  breadcrumbs?: PageBreadcrumb[];
  description?: string;
  actions?: ReactNode;
  actionsPortal?: boolean;
  showTitle?: boolean;
  segment?: NavigationSegment;
  resetTrail?: NavigationSegment[];
}) {
  const { setHeader } = usePageHeaderState();
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
      actionsPortal,
      showTitle
    });
  }, [pathname, title, crumbKey, description, actions, actionsPortal, showTitle, setHeader]);

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
      breadcrumbs: [{ label: t(`group_${best.groupKey}` as "group_home") }]
    };
  }, [pathname, t]);
}

export function useResolvedPageHeader(): PageHeaderValue {
  const { header } = usePageHeaderState();
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
      actionsPortal: header.actionsPortal,
      showTitle: header.showTitle ?? true
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
