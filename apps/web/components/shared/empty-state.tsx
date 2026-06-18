import type { ReactNode } from "react";
import { Icon } from "../../app/lib/material-icon";
import { cn } from "../../lib/utils";

export type EmptyStateProps = {
  /** Material Symbols ligature for the leading glyph. */
  icon?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Optional call-to-action (e.g. a `<button className="btn-primary">`). */
  action?: ReactNode;
  /** Compact variant for inline/table contexts. */
  compact?: boolean;
  className?: string;
};

/**
 * Consistent empty / first-run block. Use for "no records yet", filtered-to-zero,
 * and error fallbacks instead of a bare `<p className="muted">`.
 */
export function EmptyState({ icon, title, description, action, compact, className }: EmptyStateProps) {
  return (
    <div className={cn("empty-state", compact && "empty-state--compact", className)}>
      {icon ? (
        <span className="empty-state__icon" aria-hidden>
          <Icon name={icon} size={compact ? 20 : 28} />
        </span>
      ) : null}
      <p className="empty-state__title">{title}</p>
      {description ? <p className="empty-state__desc">{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
