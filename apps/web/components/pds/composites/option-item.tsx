"use client";

import * as React from "react";
import { CheckBox } from "../subcomponents/check-box";
import { Divider } from "../subcomponents/divider";
import { RadioIndicator } from "../subcomponents/radio-box";
import { cn } from "../../../lib/utils";

export type OptionItemVariant = "default" | "radio" | "checkbox";
export type OptionItemState = "idle" | "hovered";

export type OptionItemProps = {
  variant?: OptionItemVariant;
  state?: OptionItemState;
  isSelected?: boolean;
  hasDivider?: boolean;
  prefix?: React.ReactNode;
  showPrefix?: boolean;
  hasValue?: boolean;
  valueText?: string;
  label?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  onSelect?: () => void;
};

const FIGMA_NODES: Record<OptionItemVariant, string> = {
  default: "35:13664",
  radio: "35:13688",
  checkbox: "35:13709",
};

/** List row built from atomic subcomponents — Figma option-items variants. */
export function OptionItem({
  variant = "default",
  state = "idle",
  isSelected = false,
  hasDivider = true,
  prefix,
  showPrefix = false,
  hasValue = false,
  valueText = "Value",
  label = "Label",
  disabled = false,
  className,
  onSelect,
}: OptionItemProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      disabled={disabled}
      className={cn(
        "pds-option-item",
        `pds-option-item--${variant}`,
        state === "hovered" && "pds-option-item--hovered",
        isSelected && "pds-option-item--selected",
        className
      )}
      data-figma-node={FIGMA_NODES[variant]}
      onClick={onSelect}
    >
      {showPrefix ? (
        <span className="pds-option-item__prefix">{prefix}</span>
      ) : null}
      <span className="pds-type-body-m-medium pds-option-item__label">{label}</span>
      {hasValue ? (
        <span className="pds-type-body-m-medium pds-option-item__value">{valueText}</span>
      ) : null}
      {variant === "radio" ? (
        <RadioIndicator checked={isSelected} disabled={disabled} size="sm" />
      ) : null}
      {variant === "checkbox" ? (
        <CheckBox
          checked={isSelected}
          disabled={disabled}
          size="sm"
          showLabel={false}
          showDescription={false}
        />
      ) : null}
      {hasDivider ? (
        <Divider className="pds-option-item__divider" size="sm" />
      ) : null}
    </button>
  );
}
