import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

/**
 * Semantic tone for a badge. Tones map to status-color tokens in globals.css
 * (`.badge--tone-*`). Prefer tones over raw status names so every module reads
 * the same regardless of the underlying domain vocabulary.
 */
export type BadgeTone = "neutral" | "success" | "info" | "warning" | "danger" | "brand";

export type BadgeProps = {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
};

/**
 * Canonical status pill. Single source of truth for the badge shape used across
 * tables, hero headers, lists, and detail pages. Replaces ad-hoc
 * `<span className="badge badge--x">` duplication.
 */
export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  return <span className={cn("pds-type-body-s-semibold badge", `badge--tone-${tone}`, className)}>{children}</span>;
}

/**
 * Maps a domain status string to a semantic tone. Unknown statuses fall back to
 * neutral so a new status never renders unstyled. Keep this list as the one
 * place that knows how a status should *feel*.
 */
const STATUS_TONE: Record<string, BadgeTone> = {
  // success / positive
  active: "success",
  enrolled: "success",
  verified: "success",
  approved: "success",
  paid: "success",
  completed: "success",
  published: "success",
  confirmed: "success",
  enabled: "success",
  // info / in-progress
  invited: "info",
  scheduled: "info",
  processing: "info",
  in_progress: "info",
  // warning / attention
  pending: "warning",
  draft: "warning",
  partial: "warning",
  due: "warning",
  unpaid: "info",
  trial: "warning",
  // danger / negative
  archived: "danger",
  suspended: "danger",
  overdue: "danger",
  refund: "danger",
  refunded: "danger",
  failed: "danger",
  rejected: "danger",
  cancelled: "danger",
  canceled: "danger",
  void: "danger",
  disabled: "danger"
};

export function statusTone(status: string | null | undefined): BadgeTone {
  if (!status) return "neutral";
  return STATUS_TONE[status.toLowerCase()] ?? "neutral";
}

export type StatusBadgeProps = {
  status: string | null | undefined;
  /** Display text; defaults to the raw status. Pass a translated label here. */
  label?: ReactNode;
  className?: string;
};

/**
 * Status pill that derives its tone from a domain status string. Use this for
 * the recurring `badge badge--${status}` pattern in tables and detail pages.
 */
export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <Badge tone={statusTone(status)} className={className}>
      {label ?? status ?? "—"}
    </Badge>
  );
}
