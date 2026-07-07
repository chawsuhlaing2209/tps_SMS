"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Icon } from "../../app/lib/material-icon";
import { type NavigationSegment, useNavigationParent } from "../../app/lib/navigation-trail";
import { cn } from "../../lib/utils";

type NavigationBackLinkProps = {
  /** Shown when there is no trail parent (e.g. module list). */
  fallback?: NavigationSegment;
  className?: string;
};

/** Contextual back link to the page that opened this detail view. */
export function NavigationBackLink({ fallback, className }: NavigationBackLinkProps) {
  const pathname = usePathname();
  const c = useTranslations("common");
  const parent = useNavigationParent();

  const target = useMemo(() => {
    if (parent && parent.href !== pathname) {
      return parent;
    }
    return fallback ?? null;
  }, [parent, pathname, fallback]);

  if (!target) {
    return null;
  }

  return (
    <Link href={target.href} className={cn("page-back-link", className)}>
      <Icon name="arrow_back" size={18} />
      {c("backToName", { name: target.label })}
    </Link>
  );
}
