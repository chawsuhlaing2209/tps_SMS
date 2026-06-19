"use client";

import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import { CheckBox } from "./check-box";

export type CheckListItemProps = {
  /** Controlled checked state. */
  checked?: boolean;
  disabled?: boolean;
  label: ReactNode;
  description?: ReactNode;
  /** Right-aligned value (e.g. fee amount). */
  trailing?: ReactNode;
  id?: string;
  className?: string;
  onCheckedChange?: (checked: boolean) => void;
};

/**
 * Selectable list row — Figma option-items/checkbox (35:13709) + fee-components card rows.
 * The entire row is the hit target; selected rows use `--pds-background-frame`.
 */
export function CheckListItem({
  checked = false,
  disabled = false,
  label,
  description,
  trailing,
  id,
  className,
  onCheckedChange,
}: CheckListItemProps) {
  const fieldId = id;

  return (
    <label
      className={cn(
        "pds-check-list-item",
        checked && "pds-check-list-item--checked",
        trailing != null && "pds-check-list-item--has-trailing",
        disabled && "pds-check-list-item--disabled",
        className,
      )}
      data-figma-node="35:13709"
      htmlFor={fieldId}
    >
      <CheckBox
        id={fieldId}
        size="sm"
        showLabel={false}
        disabled={disabled}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="pds-check-list-item__control"
      />
        <span className="pds-check-list-item__text">
        <span className="pds-type-body-m-bold pds-check-list-item__label">{label}</span>
        {description ? (
          <span className="pds-type-body-s-regular pds-check-list-item__desc">{description}</span>
        ) : null}
      </span>
      {trailing != null ? (
        <span className="pds-type-body-m-bold pds-check-list-item__trailing">{trailing}</span>
      ) : null}
    </label>
  );
}
