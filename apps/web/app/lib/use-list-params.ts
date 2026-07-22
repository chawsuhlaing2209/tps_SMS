"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

/**
 * Query-param-backed list state: filters written to the URL survive detail
 * navigation and back (browser back or a navigation-trail back link).
 *
 * Semantics:
 * - `get(key, default)` — an ABSENT param returns the default; a PRESENT but
 *   empty param returns "" (lets "All time" clear a picker whose default is
 *   the current month without falling back to it).
 * - `patch({ key: value | null })` — null deletes the param (back to default);
 *   several keys update atomically in one replace (e.g. filter + page reset).
 *   Uses router.replace so filter tweaks don't pollute browser history.
 * - `currentUrl` — pathname + query; pass as the navigation-trail `from.href`
 *   so back-links land on the filtered list, not the bare route.
 */
export function useListParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const get = useCallback(
    (key: string, defaultValue = "") =>
      searchParams.has(key) ? (searchParams.get(key) ?? "") : defaultValue,
    [searchParams]
  );

  const patch = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const currentUrl = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);

  return { get, patch, currentUrl };
}
