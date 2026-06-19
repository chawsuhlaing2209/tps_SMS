"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as React from "react";
import { Icon } from "../../../app/lib/material-icon";
import { cn } from "../../../lib/utils";

export type CheckBoxSize = "md" | "sm";

const ICON_SIZE: Record<CheckBoxSize, number> = {
  md: 24,
  sm: 16,
};

export type CheckBoxProps = {
  /** Controlled checked state. Omit for interactive uncontrolled usage. */
  checked?: boolean;
  /** Initial checked state when uncontrolled. */
  defaultChecked?: boolean;
  /** Figma: isIndeterminate */
  indeterminate?: boolean;
  /** Figma: isDisabled */
  disabled?: boolean;
  /** Figma: hasLabel */
  showLabel?: boolean;
  /** Figma: hasDescription */
  showDescription?: boolean;
  label?: React.ReactNode;
  description?: React.ReactNode;
  size?: CheckBoxSize;
  className?: string;
  id?: string;
  name?: string;
  onCheckedChange?: (checked: boolean) => void;
};

function checkboxIconName(checked: boolean, indeterminate?: boolean) {
  if (indeterminate) return "indeterminate_check_box";
  if (checked) return "check_box";
  return "check_box_outline_blank";
}

function CheckboxIndicator({
  checked,
  indeterminate,
  disabled,
  size,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  size: CheckBoxSize;
}) {
  const active = checked || indeterminate;
  return (
    <span
      className={cn(
        "pds-check-box__indicator",
        size === "sm" && "pds-check-box__indicator--sm",
        checked && "pds-check-box__indicator--checked",
        indeterminate && "pds-check-box__indicator--indeterminate",
        disabled && "pds-check-box__indicator--disabled"
      )}
      data-figma-node={
        indeterminate
          ? "35:14939"
          : checked
            ? "35:14954"
            : "35:14934"
      }
    >
      <Icon
        name={checkboxIconName(checked, indeterminate)}
        filled={active}
        size={ICON_SIZE[size]}
      />
    </span>
  );
}

/** Checkbox field or indicator — Figma node 35:14933. Interactive by default. */
export function CheckBox({
  checked,
  defaultChecked = false,
  indeterminate = false,
  disabled = false,
  showLabel = true,
  showDescription = false,
  label = "Label",
  description = "A single line description with lorem Ipsum.",
  size = "md",
  className,
  id,
  name,
  onCheckedChange,
}: CheckBoxProps) {
  const autoId = React.useId();
  const fieldId = id ?? autoId;
  const isControlled = checked !== undefined;
  const [uncontrolledChecked, setUncontrolledChecked] = React.useState(defaultChecked);
  const isChecked = isControlled ? checked : uncontrolledChecked;
  const controlOnly = size === "sm" && !showLabel && !showDescription;
  const controlSize = controlOnly ? size : "md";

  const handleCheckedChange = (next: boolean | "indeterminate") => {
    if (!isControlled) {
      setUncontrolledChecked(next === true);
    }
    onCheckedChange?.(next === true);
  };

  const root = (
    <CheckboxPrimitive.Root
      id={fieldId}
      name={name}
      aria-label={!showLabel && label != null ? String(label) : undefined}
      className={cn(
        "pds-check-box__input",
        controlSize === "sm" && "pds-check-box__input--sm"
      )}
      checked={
        isControlled ? (indeterminate ? "indeterminate" : checked) : undefined
      }
      defaultChecked={!isControlled ? defaultChecked : undefined}
      disabled={disabled}
      onCheckedChange={handleCheckedChange}
    >
      <CheckboxIndicator
        checked={isChecked}
        indeterminate={indeterminate}
        disabled={disabled}
        size={controlSize}
      />
    </CheckboxPrimitive.Root>
  );

  if (controlOnly) {
    return root;
  }

  return (
    <label
      className={cn(
        "pds-check-box",
        showDescription && "pds-check-box--with-description",
        disabled && "pds-check-box--disabled",
        className
      )}
      data-figma-node="35:14933"
      htmlFor={fieldId}
    >
      {root}
      {showLabel ? (
          <span className="pds-check-box__text">
          <span className="pds-type-body-m-medium pds-check-box__label">{label}</span>
          {showDescription ? (
            <span className="pds-type-body-s-regular pds-check-box__description">{description}</span>
          ) : null}
        </span>
      ) : null}
    </label>
  );
}
