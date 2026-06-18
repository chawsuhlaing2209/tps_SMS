"use client";

import type { InputHTMLAttributes } from "react";
import { Icon } from "./material-icon";

/** Rounded search field — matches `.dash-search` (single border, no nested input chrome). */
export function TableSearchInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={["table-search", className].filter(Boolean).join(" ")}>
      <Icon name="search" size={19} className="table-search__icon" aria-hidden />
      <input type="text" className="table-search__input" {...props} />
    </div>
  );
}
