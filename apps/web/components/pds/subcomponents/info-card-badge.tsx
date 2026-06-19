"use client";

import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";

export type InfoCardBadgeProps = {
  children: ReactNode;
  className?: string;
};

/** Uppercase lime label for InfoCard callouts (e.g. GLOBAL RULE). */
export function InfoCardBadge({ children, className }: InfoCardBadgeProps) {
  return <span className={cn("pds-info-card-badge", className)}>{children}</span>;
}
