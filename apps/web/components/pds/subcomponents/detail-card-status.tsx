"use client";

import type { ReactNode } from "react";
import { StatusPill, type StatusPillProps } from "./status-pill";

export type DetailCardStatusProps = {
  children: ReactNode;
  tone?: StatusPillProps["tone"];
  className?: string;
};

/** Status chip beside a DetailCard title — uses canonical StatusPill styling. */
export function DetailCardStatus({ children, tone = "active", className }: DetailCardStatusProps) {
  return (
    <StatusPill tone={tone} className={className}>
      {children}
    </StatusPill>
  );
}
