"use client";

import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";

export type DetailCardStatusProps = {
  children: ReactNode;
  className?: string;
};

/** Success-toned status chip shown beside a DetailCard title. */
export function DetailCardStatus({ children, className }: DetailCardStatusProps) {
  return (
    <span className={cn("pds-type-body-s-bold pds-detail-card-status", className)}>
      {children}
    </span>
  );
}
