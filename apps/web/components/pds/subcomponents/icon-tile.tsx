"use client";

import type { ReactNode } from "react";
import { Icon } from "../../../app/lib/material-icon";
import { cn } from "../../../lib/utils";
import type { PdsIconTileTone } from "../palettes";

export type IconTileProps = {
  /** Material Symbols Rounded ligature. */
  icon: string;
  tone?: PdsIconTileTone;
  /** Icon size in px (default 20). */
  size?: number;
  className?: string;
  children?: ReactNode;
};

/**
 * Square rounded tinted tile + matching filled icon — standard row/card identity
 * marker (distinct from EntityAvatar's solid squircle).
 */
export function IconTile({ icon, tone = "blue", size = 20, className, children }: IconTileProps) {
  return (
    <span className={cn("pds-icon-tile", `pds-icon-tile--${tone}`, className)} aria-hidden>
      <Icon name={icon} filled size={size} />
      {children}
    </span>
  );
}
