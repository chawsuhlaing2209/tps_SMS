"use client";

import * as React from "react";
import { Options, type OptionsProps } from "./options";
import { cn } from "../../../lib/utils";

export type SelectItemPosition = "top" | "bottom";

export type SelectItemPositionProps = {
  position?: SelectItemPosition;
  open?: boolean;
  children?: React.ReactNode;
  optionsProps?: OptionsProps;
  className?: string;
};

/** Positions a panel above or below an anchor — Figma node 35:12288.
 *  Slot-based: pass `children` (any panel) or convenience `optionsProps` for Options.
 *  Reusable outside PdsSelect — e.g. custom popover content with the same offset/shadow. */
export function SelectItemPosition({
  position = "bottom",
  open = true,
  children,
  optionsProps,
  className,
}: SelectItemPositionProps) {
  if (!open) return null;

  return (
    <div
      className={cn(
        "pds-select-item-position",
        position === "top" && "pds-select-item-position--top",
        position === "bottom" && "pds-select-item-position--bottom",
        className
      )}
      data-figma-node="35:12288"
    >
      <span className="pds-select-item-position__spacer" aria-hidden="true" />
      <div className="pds-select-item-position__panel">
        {children ?? (optionsProps ? <Options {...optionsProps} fillWidth /> : null)}
      </div>
    </div>
  );
}
