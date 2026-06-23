"use client";

import * as React from "react";
import {
  PdsSelect,
  type PdsSelectProps,
  type PdsSelectState,
  type PdsSelectVariant,
} from "../composites/select";
import type { OptionsItem } from "../composites/options";

export type SelectFieldOption = {
  value: string;
  label: string;
};

export function optionsToItems(options: SelectFieldOption[]): OptionsItem[] {
  return options.map((option) => ({ id: option.value, label: option.label }));
}

const DEFAULT_PLACEHOLDER = "Select";

/** Prepends an explicit "All …" row for filter selects when missing. */
export function withFilterAllOption(
  placeholder: string,
  options: SelectFieldOption[],
  variant: PdsSelectVariant = "form"
): SelectFieldOption[] {
  if (variant !== "filter" || placeholder === DEFAULT_PLACEHOLDER) {
    return options;
  }
  if (options.some((option) => option.value === "" || option.value === "all")) {
    return options;
  }
  return [{ value: "", label: placeholder }, ...options];
}

export type PdsSelectFieldProps = Omit<PdsSelectProps, "items" | "state"> & {
  options: SelectFieldOption[];
  /** Maps to Figma Input / Select error and disabled states. */
  inputState?: "enabled" | "disabled" | "completed" | "error";
  disabled?: boolean;
  variant?: PdsSelectVariant;
};

function mapInputState(
  inputState: PdsSelectFieldProps["inputState"],
  disabled?: boolean
): PdsSelectState | undefined {
  if (disabled || inputState === "disabled") return "disabled";
  if (inputState === "error") return "error";
  return undefined;
}

/** Options-array wrapper around PdsSelect for forms and filters. */
export function PdsSelectField({
  options,
  inputState = "enabled",
  disabled,
  variant = "form",
  placeholder = DEFAULT_PLACEHOLDER,
  ...props
}: PdsSelectFieldProps) {
  const resolvedOptions = withFilterAllOption(placeholder, options, variant);

  return (
    <PdsSelect
      variant={variant}
      state={mapInputState(inputState, disabled)}
      items={optionsToItems(resolvedOptions)}
      placeholder={placeholder}
      {...props}
    />
  );
}
