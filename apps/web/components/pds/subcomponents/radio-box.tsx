"use client";

import * as React from "react";
import { Icon } from "../../../app/lib/material-icon";
import { cn } from "../../../lib/utils";

export type RadioBoxSize = "md" | "sm";

const ICON_SIZE: Record<RadioBoxSize, number> = {
  md: 24,
  sm: 16,
};

export type RadioBoxProps = {
  /** Controlled selected state. Omit for interactive uncontrolled usage. */
  checked?: boolean;
  /** Initial selected state when uncontrolled. */
  defaultChecked?: boolean;
  /** Figma: isDisabled */
  disabled?: boolean;
  /** Figma: hasLabel */
  showLabel?: boolean;
  /** Figma: hasDescription */
  showDescription?: boolean;
  label?: React.ReactNode;
  description?: React.ReactNode;
  /** Visual-only indicator (no label wrapper) for option rows. */
  size?: RadioBoxSize;
  className?: string;
  id?: string;
  name?: string;
  value?: string;
  onCheckedChange?: (checked: boolean) => void;
};

function radioIconName(checked: boolean) {
  return checked ? "radio_button_checked" : "radio_button_unchecked";
}

export function RadioIndicator({
  checked,
  disabled,
  size,
}: {
  checked: boolean;
  disabled?: boolean;
  size: RadioBoxSize;
}) {
  return (
    <span
      className={cn(
        "pds-radio-box__indicator",
        size === "sm" && "pds-radio-box__indicator--sm",
        checked && "pds-radio-box__indicator--checked",
        disabled && "pds-radio-box__indicator--disabled"
      )}
      data-figma-node={checked ? "35:14860" : "35:14844"}
    >
      <Icon name={radioIconName(checked)} filled={checked} size={ICON_SIZE[size]} />
    </span>
  );
}

/** Standalone or embedded radio control — Figma node 35:14634. Interactive by default. */
export function RadioBox({
  checked,
  defaultChecked = false,
  disabled = false,
  showLabel = true,
  showDescription = false,
  label = "Label",
  description = "Description",
  size = "md",
  className,
  id,
  name,
  value = "radio",
  onCheckedChange,
}: RadioBoxProps) {
  const autoId = React.useId();
  const fieldId = id ?? autoId;
  const isControlled = checked !== undefined;
  const [uncontrolledChecked, setUncontrolledChecked] = React.useState(defaultChecked);
  const isChecked = isControlled ? checked : uncontrolledChecked;
  const controlOnly = size === "sm" && !showLabel && !showDescription;
  const controlSize = controlOnly ? size : "md";

  const handleToggle = () => {
    if (disabled) return;
    const next = !isChecked;
    if (!isControlled) {
      setUncontrolledChecked(next);
    }
    onCheckedChange?.(next);
  };

  const control = (
    <button
      id={fieldId}
      type="button"
      role="radio"
      name={name}
      value={value}
      aria-checked={isChecked}
      disabled={disabled}
      className={cn(
        "pds-radio-box__input",
        controlSize === "sm" && "pds-radio-box__input--sm"
      )}
      onClick={handleToggle}
    >
      <RadioIndicator checked={isChecked} disabled={disabled} size={controlSize} />
    </button>
  );

  if (controlOnly) {
    return control;
  }

  return (
    <label
      className={cn(
        "pds-radio-box",
        showDescription && "pds-radio-box--with-description",
        disabled && "pds-radio-box--disabled",
        className
      )}
      data-figma-node="35:14634"
      htmlFor={fieldId}
    >
      {control}
      {showLabel ? (
        <span className="pds-radio-box__text">
          <span className="pds-type-body-m-medium pds-radio-box__label">{label}</span>
          {showDescription ? (
            <span className="pds-type-body-s-regular pds-radio-box__description">{description}</span>
          ) : null}
        </span>
      ) : null}
    </label>
  );
}
