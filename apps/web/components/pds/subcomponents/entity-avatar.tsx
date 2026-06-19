"use client";

import type { CSSProperties } from "react";
import { subjectColor } from "../../../app/dashboard/structure/subject-colors";
import { Icon } from "../../../app/lib/material-icon";
import { cn } from "../../../lib/utils";

export type EntityAvatarProps = {
  /** Material Symbols Rounded ligature for the squircle icon. */
  icon?: string;
  /** Show initials in the squircle instead of a Material icon. */
  initials?: string;
  /** Used for color hashing and icon fallback when `icon` is omitted. */
  nameForColor?: string;
  /** Override squircle background (defaults to hash of `nameForColor`). */
  color?: string;
  className?: string;
};

function swatchFor(name: string, color?: string) {
  const palette = subjectColor(name);
  return { background: color ?? palette.bg, color: palette.text };
}

/** Color-blocked squircle avatar for entity list rows — icon or initials. */
export function EntityAvatar({
  icon,
  initials,
  nameForColor = "",
  color,
  className,
}: EntityAvatarProps) {
  const swatch = swatchFor(nameForColor, color);

  return (
    <span
      className={cn("pds-entity-avatar", className)}
      style={swatch as CSSProperties}
      aria-hidden
    >
      {initials ? (
        <span className="pds-type-body-m-bold pds-entity-avatar__initials">{initials}</span>
      ) : icon ? (
        <Icon name={icon} filled size={24} />
      ) : null}
    </span>
  );
}
