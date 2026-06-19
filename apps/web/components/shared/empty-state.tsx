import type { ReactNode } from "react";
import { Icon } from "../../app/lib/material-icon";
import { cn } from "../../lib/utils";

export type EmptyStateProps = {
  /** Material Symbols ligature for the leading glyph. */
  icon?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Optional call-to-action (e.g. PDS `<Button>`). */
  action?: ReactNode;
  /** Smaller icon and tighter padding for table/modal contexts. */
  compact?: boolean;
  /** Strip card chrome when nested inside `.table-card`, `.panel`, etc. */
  embedded?: boolean;
  className?: string;
};

/**
 * PDS empty state (Figma EmptyState / node 54:2584).
 * Centered card with chartreuse icon badge, title, optional description, and CTA.
 */
export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  compact,
  embedded,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "empty-state",
        compact && "empty-state--compact",
        embedded && "empty-state--embedded",
        className,
      )}
      role="status"
    >
      {icon ? (
        <div className="empty-state__icon" aria-hidden>
          <Icon name={icon} size={compact ? 24 : 36} />
        </div>
      ) : null}
      <div className="empty-state__content">
        <p className="pds-type-title-s-extrabold empty-state__title">{title}</p>
        {description ? (
          <p className="pds-type-body-s-regular empty-state__desc">{description}</p>
        ) : null}
      </div>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
