"use client";

import "./entity-list.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { appendNavigationTrail, type NavigationSegment } from "../../../app/lib/navigation-trail";
import { subjectIcon } from "../../../app/dashboard/structure/subject-colors";
import { Panel, PanelHead } from "../../../app/lib/panel";
import { EmptyState } from "../../shared/empty-state";
import { EntityAvatar } from "../subcomponents/entity-avatar";
import { cn } from "../../../lib/utils";

export type EntityListItemProps = {
  title: string;
  meta?: ReactNode;
  /** Material Symbols Rounded ligature for the squircle icon. */
  icon?: string;
  /** Show initials in the squircle instead of a Material icon. */
  initials?: string;
  /** Used for color hashing and icon fallback when `icon` is omitted. */
  nameForColor?: string;
  /** Override squircle background (defaults to hash of `nameForColor` or `title`). */
  color?: string;
  href?: string;
  onClick?: () => void;
  /** Trailing action label (e.g. "Open >"). Omit to hide the action column. */
  actionLabel?: string;
  /** Replaces the default action (e.g. status badge). */
  trailing?: ReactNode;
  /** Current page appended to the trail before following `href`. */
  navigationFrom?: NavigationSegment;
  className?: string;
};

function EntityListItemContent({
  title,
  meta,
  icon,
  initials,
  nameForColor,
  color,
  actionLabel,
  trailing,
}: EntityListItemProps) {
  const colorKey = nameForColor ?? title;
  const glyph = icon ?? (initials ? undefined : subjectIcon(colorKey));

  return (
    <>
      <EntityAvatar
        icon={glyph}
        initials={initials}
        nameForColor={colorKey}
        color={color}
      />
      <span className="pds-entity-list-item__body">
        <span className="pds-type-body-l-medium pds-entity-list-item__title">{title}</span>
        {meta ? (
          <span className="pds-type-body-s-regular pds-entity-list-item__meta">{meta}</span>
        ) : null}
      </span>
      {trailing ? (
        <span className="pds-entity-list-item__trailing">{trailing}</span>
      ) : actionLabel ? (
        <span className="pds-type-body-s-semibold pds-entity-list-item__action">{actionLabel}</span>
      ) : null}
    </>
  );
}

/** Single entity row — squircle avatar, stacked title + meta, optional trailing action. */
export function EntityListItem(props: EntityListItemProps) {
  const { href, onClick, navigationFrom, className } = props;
  const itemClass = cn("pds-entity-list-item", className);

  if (href) {
    return (
      <Link
        href={href}
        className={itemClass}
        onClick={() => {
          if (navigationFrom) {
            appendNavigationTrail(navigationFrom);
          }
        }}
      >
        <EntityListItemContent {...props} />
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={cn(itemClass, "pds-entity-list-item--button")} onClick={onClick}>
        <EntityListItemContent {...props} />
      </button>
    );
  }

  return (
    <div className={itemClass}>
      <EntityListItemContent {...props} />
    </div>
  );
}

/** Vertical stack of {@link EntityListItem} cards with consistent spacing. */
export function EntityList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("pds-entity-list", className)}>{children}</div>;
}

/** Panel wrapper for an {@link EntityList} section. */
export function EntityListPanel({
  title,
  help,
  empty,
  emptyDescription,
  emptyIcon,
  emptyAction,
  children,
  className,
}: {
  title?: ReactNode;
  help?: ReactNode;
  empty?: ReactNode;
  emptyDescription?: ReactNode;
  emptyIcon?: string;
  emptyAction?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Panel className={cn("pds-entity-list-panel", className)}>
      <PanelHead title={title} help={help} />
      {empty ? (
        <div className="panel-body">
          <EmptyState
            compact
            embedded
            icon={emptyIcon ?? "inbox"}
            title={empty}
            description={emptyDescription}
            action={emptyAction}
          />
        </div>
      ) : (
        <div className="panel-body">{children}</div>
      )}
    </Panel>
  );
}
