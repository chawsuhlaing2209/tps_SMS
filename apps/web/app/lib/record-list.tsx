"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { subjectColor, subjectIcon } from "../dashboard/structure/subject-colors";
import { Icon } from "./icon";
import { Panel, PanelHead } from "./panel";

export type RecordListItemProps = {
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
  /** Trailing action label (defaults to caller/i18n). Omit to hide the action column. */
  actionLabel?: string;
  /** Replaces the default "Open ›" action (e.g. status badge). */
  trailing?: ReactNode;
};

function swatchFor(name: string, color?: string) {
  const palette = subjectColor(name);
  return { background: color ?? palette.bg, color: palette.text };
}

function RecordListItemContent({
  title,
  meta,
  icon,
  initials,
  nameForColor,
  color,
  actionLabel,
  trailing
}: RecordListItemProps) {
  const colorKey = nameForColor ?? title;
  const swatch = swatchFor(colorKey, color);
  const glyph = icon ?? subjectIcon(colorKey);

  return (
    <>
      <span className="record-list-item__icon" style={swatch as CSSProperties} aria-hidden>
        {initials ? (
          <span className="record-list-item__initials">{initials}</span>
        ) : (
          <Icon name={glyph} filled size={21} />
        )}
      </span>
      <span className="record-list-item__body">
        <span className="record-list-item__title">{title}</span>
        {meta ? <span className="record-list-item__meta">{meta}</span> : null}
      </span>
      {trailing ? (
        <span className="record-list-item__trailing">{trailing}</span>
      ) : actionLabel ? (
        <span className="record-list-item__action">{actionLabel}</span>
      ) : null}
    </>
  );
}

/** Single Padauk list row: squircle icon, stacked title + meta, optional Open action. */
export function RecordListItem(props: RecordListItemProps) {
  const { href, onClick } = props;
  const className = "record-list-item";

  if (href) {
    return (
      <Link href={href} className={className}>
        <RecordListItemContent {...props} />
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={`${className} record-list-item--button`} onClick={onClick}>
        <RecordListItemContent {...props} />
      </button>
    );
  }

  return (
    <div className={className}>
      <RecordListItemContent {...props} />
    </div>
  );
}

/** Vertical stack of {@link RecordListItem} rows with consistent spacing. */
export function RecordList({ children }: { children: ReactNode }) {
  return <div className="record-list">{children}</div>;
}

/** White panel wrapper for a {@link RecordList} section. */
export function RecordListPanel({
  title,
  help,
  empty,
  children
}: {
  title: ReactNode;
  help?: ReactNode;
  empty?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Panel className="record-list-panel">
      <PanelHead title={title} help={help} />
      {empty ? (
        <div className="panel-body">
          <p className="muted">{empty}</p>
        </div>
      ) : (
        <div className="panel-body">{children}</div>
      )}
    </Panel>
  );
}
