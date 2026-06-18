"use client";

import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./material-icon";

export type DetailHeroProps = {
  /** Title shown large in white on the ink-green banner. */
  title: string;
  /** Secondary meta line rendered under the title. */
  meta?: ReactNode;
  /** Text for the colored squircle mark (e.g. initials / letter). Ignored when `markIcon` is set. */
  markText?: string;
  /** Material Symbols ligature rendered inside the squircle instead of `markText`. */
  markIcon?: string;
  /** Background color for the squircle mark (a category-palette hex). */
  markColor?: string;
  /** Right-aligned primary actions slot (e.g. lime CTA + dark pill). */
  actions?: ReactNode;
  /** Subtle utility actions (e.g. edit/delete icon buttons) rendered before the primary actions. */
  utility?: ReactNode;
};

/**
 * Dark ink-green rounded banner used on detail pages: colored squircle mark +
 * title + meta line + a right-aligned actions slot. Generic enough that
 * student / subject / salary / invoice detail pages can adopt it.
 */
export function DetailHero({
  title,
  meta,
  markText,
  markIcon,
  markColor,
  actions,
  utility
}: DetailHeroProps) {
  const markStyle: CSSProperties | undefined = markColor ? { background: markColor } : undefined;
  return (
    <section className="detail-hero">
      <div className="detail-hero__main">
        {markText || markIcon ? (
          <span className="detail-hero__mark" style={markStyle}>
            {markIcon ? <Icon name={markIcon} filled size={28} /> : markText}
          </span>
        ) : null}
        <div className="detail-hero__text">
          <h1 className="detail-hero__title">{title}</h1>
          {meta ? <p className="detail-hero__meta">{meta}</p> : null}
        </div>
      </div>
      {utility || actions ? (
        <div className="detail-hero__actions">
          {utility ? <div className="detail-hero__utility">{utility}</div> : null}
          {actions}
        </div>
      ) : null}
    </section>
  );
}
