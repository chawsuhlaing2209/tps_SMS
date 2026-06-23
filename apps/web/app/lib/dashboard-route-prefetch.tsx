"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { runWhenIdle } from "./run-when-idle";
import { collectVisibleNavHrefs } from "./visible-nav-hrefs";

/** Pre-compiles route JS for every sidebar destination while the user is idle. */
export function DashboardRoutePrefetch({
  permissions
}: {
  permissions: readonly string[];
}) {
  const router = useRouter();

  useEffect(() => {
    const hrefs = collectVisibleNavHrefs(permissions);
    if (!hrefs.length) {
      return;
    }

    runWhenIdle(() => {
      for (const href of hrefs) {
        router.prefetch(href);
      }
    });
  }, [permissions, router]);

  return null;
}
