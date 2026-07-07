"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * SSR-safe media query hook. Server snapshot is `false` (desktop-first) so
 * hydration never mismatches; mobile-only UI appears after mount.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Below the lg breakpoint (960px = --pds-breakpoint-lg) the sidebar becomes a drawer. */
export function useIsMobileShell(): boolean {
  return useMediaQuery("(max-width: 959.98px)");
}

/** Below the md breakpoint (720px = --pds-breakpoint-md) tables may render as card lists. */
export function useIsMobileTable(): boolean {
  return useMediaQuery("(max-width: 719.98px)");
}
