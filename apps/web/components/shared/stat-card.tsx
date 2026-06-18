import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export type StatCardProps = {
  label: ReactNode;
  value: ReactNode;
  /** Optional secondary line under the value (delta, unit, context). */
  hint?: ReactNode;
  /** Optional Material Symbols ligature shown as a tinted leading mark. */
  icon?: ReactNode;
  /** Lime brand emphasis for the single most important metric in a grid. */
  accent?: boolean;
  className?: string;
};

/**
 * Single metric tile. Replaces the repeated
 * `.stat-card > .stat-label + .stat-value` markup in finance, admissions,
 * dashboard, etc. Compose multiples inside `StatGrid`.
 */
export function StatCard({ label, value, hint, icon, accent, className }: StatCardProps) {
  return (
    <article className={cn("stat-card", accent && "stat-card--accent", className)}>
      {icon ? <span className="stat-card__icon" aria-hidden>{icon}</span> : null}
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint ? <span className="stat-card__hint">{hint}</span> : null}
    </article>
  );
}

/** Responsive grid wrapper for a row of `StatCard`s. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("stat-grid", className)}>{children}</div>;
}
