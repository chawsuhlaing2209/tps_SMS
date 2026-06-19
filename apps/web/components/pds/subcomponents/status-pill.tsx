"use client";

import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import type { PdsStatusPillTone } from "../palettes";

export type StatusPillProps = {
  tone?: PdsStatusPillTone;
  children: ReactNode;
  className?: string;
};

/** Semantic status pill — paid, partial, overdue, due, scholarship. */
export function StatusPill({ tone = "neutral", children, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "pds-type-body-s-semibold pds-status-pill",
        `pds-status-pill--${tone}`,
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_PILL_TONE: Record<string, PdsStatusPillTone> = {
  paid: "paid",
  partial: "partial",
  overdue: "overdue",
  due: "due",
  scholarship: "scholarship",
  active: "paid",
  enrolled: "paid",
  approved: "paid",
  pending: "partial",
  draft: "partial",
  unpaid: "due",
  invited: "due",
  archived: "overdue",
  suspended: "overdue",
  failed: "overdue",
};

export function statusPillTone(status: string | null | undefined): PdsStatusPillTone {
  if (!status) return "neutral";
  return STATUS_PILL_TONE[status.toLowerCase()] ?? "neutral";
}

export type DomainStatusPillProps = {
  status: string | null | undefined;
  label?: ReactNode;
  className?: string;
};

/** Status pill that maps a domain status string to the correct tone. */
export function DomainStatusPill({ status, label, className }: DomainStatusPillProps) {
  return (
    <StatusPill tone={statusPillTone(status)} className={className}>
      {label ?? status ?? "—"}
    </StatusPill>
  );
}
