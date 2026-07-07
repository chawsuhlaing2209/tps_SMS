"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Icon } from "./material-icon";

export type DetailHeroVariant = "default" | "classroom";

export type DetailHeroProps = {
  /** Visual profile — classroom adds eyebrow label, 72px mark, and dashboard-style meta. */
  variant?: DetailHeroVariant;
  /** Lime eyebrow above the title (classroom variant). */
  eyebrow?: ReactNode;
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
  variant = "default",
  eyebrow,
  title,
  meta,
  markText,
  markIcon,
  markColor,
  actions,
  utility
}: DetailHeroProps) {
  const isClassroom = variant === "classroom";
  const markStyle: CSSProperties | undefined = markColor ? { background: markColor } : undefined;

  return (
    <section className={cn("detail-hero", isClassroom && "detail-hero--classroom")}>
      <div className="detail-hero__main">
        {markText || markIcon ? (
          <span className="pds-type-display-m detail-hero__mark" style={markStyle}>
            {markIcon ? <Icon name={markIcon} filled size={28} /> : markText}
          </span>
        ) : null}
        <div className="detail-hero__text">
          {isClassroom && eyebrow ? (
            <p className="pds-type-body-s-bold detail-hero__eyebrow">{eyebrow}</p>
          ) : null}
          <h1 className="pds-type-title-xl-extrabold detail-hero__title">{title}</h1>
          {meta ? (
            <p
              className={cn(
                "detail-hero__meta",
                isClassroom ? "pds-type-body-s-regular" : "pds-type-body-m-medium",
              )}
            >
              {meta}
            </p>
          ) : null}
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
