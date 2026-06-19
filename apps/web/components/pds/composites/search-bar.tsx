"use client";

import type { InputHTMLAttributes } from "react";
import { Icon } from "../../../app/lib/material-icon";
import { cn } from "../../../lib/utils";

export type PdsSearchBarProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "className"
> & {
  className?: string;
  /** Fixed 320px (Figma filter row) or grow within a flex row. */
  width?: "fixed" | "fluid";
};

/** Table/filter search field — placeholder left, search icon trailing (Figma 76:9646). */
export function PdsSearchBar({
  className,
  width = "fixed",
  ...props
}: PdsSearchBarProps) {
  return (
    <label
      className={cn(
        "pds-search-bar pds-type-body-m-medium",
        width === "fluid" && "pds-search-bar--fluid",
        className,
      )}
    >
      <input
        type="search"
        className="pds-search-bar__input pds-type-body-m-medium"
        {...props}
      />
      <Icon name="search" size={20} className="pds-search-bar__icon" aria-hidden />
    </label>
  );
}
