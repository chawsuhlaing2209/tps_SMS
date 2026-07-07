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
  /** Figma `type=compact` — tighter gap and smaller icon badge. */
  compact?: boolean;
  /** Strip card chrome when nested inside `.table-card` (or legacy `.table-card__body`). */
  embedded?: boolean;
  className?: string;
};

/**
 * PDS empty state (Figma EmptyState / node 54:2584).
 * Variants: comfort (default) and compact (`compact` prop).
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
          <Icon name={icon} size={compact ? 24 : 32} />
        </div>
      ) : null}
      <div className="empty-state__content">
        <p className="pds-type-title-xs-bold empty-state__title">{title}</p>
        {description ? (
          <p className="pds-type-body-s-regular empty-state__desc">{description}</p>
        ) : null}
      </div>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
