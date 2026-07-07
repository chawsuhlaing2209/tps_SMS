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
  /** Frame surface with link-green hero value (e.g. outstanding balance). */
  layout?: boolean;
  /** Ink-green shell for high-contrast totals (e.g. collected / paid). */
  dark?: boolean;
  className?: string;
};

/**
 * Single metric tile. Replaces the repeated
 * `.stat-card > .stat-label + .stat-value` markup in finance, admissions,
 * dashboard, etc. Compose multiples inside `StatGrid`.
 */
export function StatCard({ label, value, hint, icon, accent, layout, dark, className }: StatCardProps) {
  return (
    <article
      className={cn(
        "stat-card",
        accent && "stat-card--accent",
        layout && "stat-card--layout",
        dark && "stat-card--dark",
        className,
      )}
    >
      {icon ? <span className="stat-card__icon" aria-hidden>{icon}</span> : null}
      <span className="pds-type-caption-s stat-label">{label}</span>
      <span className="pds-type-title-l-extrabold stat-value">{value}</span>
      {hint ? <span className="pds-type-label-s-bold stat-card__hint">{hint}</span> : null}
    </article>
  );
}

/** Responsive grid wrapper for a row of `StatCard`s. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("stat-grid", className)}>{children}</div>;
}
