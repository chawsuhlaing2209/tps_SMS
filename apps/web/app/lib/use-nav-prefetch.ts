"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  prefetchPathsForDashboardRoute,
  prefetchTenantPaths,
  readCachedAcademicYear
} from "./query-cache";
import { getSession } from "./session";

/** Prefetch route bundle + likely API reads when the user hovers a sidebar link. */
export function useNavPrefetch() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useCallback(
    (href: string) => {
      const session = getSession();
      if (!session?.tenantId || session.isPlatform) {
        return;
      }

      router.prefetch(href);

      const academicYear = readCachedAcademicYear(queryClient, session.tenantId);
      const paths = prefetchPathsForDashboardRoute(session.tenantId, href, academicYear);
      void prefetchTenantPaths(queryClient, session.tenantId, paths);
    },
    [queryClient, router]
  );
}
