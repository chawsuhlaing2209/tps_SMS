"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { subjectColor } from "../dashboard/structure/subject-colors";

function deriveInitials(name: string) {
  const parsed = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return parsed || "?";
}

export type PersonCardProps = {
  /** Primary name shown in bold. */
  name: string;
  /** Secondary line under the name (e.g. roll + guardian). */
  secondary?: ReactNode;
  /** Override the squircle initials (defaults to initials derived from `name`). */
  initials?: string;
  /** Override the squircle background color (defaults to a hash of `name`). */
  color?: string;
  /** Render the card as a link. */
  href?: string;
  /** Render the card as a button (ignored when `href` is set). */
  onClick?: () => void;
};

/**
 * Squircle-avatar card used in record rosters: a color-blocked initials avatar +
 * name + secondary line. Renders as a link, button, or static element.
 */
export function PersonCard({
  name,
  secondary,
  initials,
  color,
  href,
  onClick
}: PersonCardProps) {
  const swatch = subjectColor(name);
  const avatarStyle: CSSProperties = { background: color ?? swatch.bg, color: swatch.text };
  const content = (
    <>
      <span className="person-card__avatar" style={avatarStyle} aria-hidden>
        {initials ?? deriveInitials(name)}
      </span>
      <span className="person-card__body">
        <span className="person-card__name">{name}</span>
        {secondary ? <span className="person-card__meta">{secondary}</span> : null}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="person-card">
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" className="person-card person-card--button" onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className="person-card">{content}</div>;
}

/**
 * Responsive grid (2-col by default) for {@link PersonCard} or similar record
 * cards.
 */
export function RecordCardGrid({
  children,
  columns = 2
}: {
  children: ReactNode;
  columns?: number;
}) {
  const style: CSSProperties | undefined =
    columns === 2 ? undefined : { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
  return (
    <div className="record-card-grid" style={style}>
      {children}
    </div>
  );
}
