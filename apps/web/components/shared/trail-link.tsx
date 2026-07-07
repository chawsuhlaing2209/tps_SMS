"use client";

import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";
import { appendNavigationTrail, type NavigationSegment } from "../../app/lib/navigation-trail";

type TrailLinkProps = LinkProps & {
  from: NavigationSegment;
  children: ReactNode;
  className?: string;
};

/** Link that records the source page so the destination can show a back button. */
export function TrailLink({ from, href, onClick, children, className, ...props }: TrailLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={(event) => {
        appendNavigationTrail(from);
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </Link>
  );
}
