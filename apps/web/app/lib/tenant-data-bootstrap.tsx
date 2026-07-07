"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  prefetchPathsForDashboardRoute,
  prefetchTenantPaths,
  readCachedAcademicYear,
  warmTenantDashboardCache
} from "./query-cache";
import { getSession } from "./session";

/**
 * Warms shared API cache as soon as the dashboard shell mounts so the first
 * click into any module can reuse data already in flight or finished.
 */
export function TenantDataBootstrap({
  permissions
}: {
  permissions: readonly string[];
}) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const warmedRef = useRef(false);

  useEffect(() => {
    const session = getSession();
    if (!session?.tenantId || session.isPlatform) {
      return;
    }

    if (!warmedRef.current) {
      warmedRef.current = true;
      void warmTenantDashboardCache(
        queryClient,
        session.tenantId,
        permissions,
        pathname
      );
      return;
    }

    const academicYear = readCachedAcademicYear(queryClient, session.tenantId);
    const paths = prefetchPathsForDashboardRoute(session.tenantId, pathname, academicYear);
    void prefetchTenantPaths(queryClient, session.tenantId, paths);
  }, [pathname, permissions, queryClient]);

  return null;
}
