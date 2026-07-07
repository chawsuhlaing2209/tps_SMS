"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { Icon } from "../../app/lib/material-icon";
import type { InputState } from "./input-types";

export type InputChipProps = {
  label: string;
  onRemove?: () => void;
  className?: string;
};

/** Removable value chip shown below an input (Figma Input → Chip groups). */
export function InputChip({ label, onRemove, className }: InputChipProps) {
  return (
    <span className={cn("input-chip", className)}>
      <span className="pds-type-body-s-regular input-chip__label">{label}</span>
      {onRemove ? (
        <button type="button" className="input-chip__remove" onClick={onRemove} aria-label={`Remove ${label}`}>
          <Icon name="close" size={12} />
        </button>
      ) : null}
    </span>
  );
}

export function InputChipGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("input-chip-group", className)}>{children}</div>;
}

export type InputWrapperProps = {
  /** Field label — rendered as uppercase caption by default (Figma Input Wrapper). */
  label?: string;
  htmlFor?: string;
  required?: boolean;
  readOnly?: boolean;
  /** Shown beside the label when `readOnly` is true. */
  readOnlyLabel?: string;
  error?: string;
  hint?: string;
  /** Optional helper link below the field. */
  link?: React.ReactNode;
  /** Chip row below the control (multi-value fields). */
  chips?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** `caps` matches Figma Input Wrapper; `default` uses body label weight. */
  labelStyle?: "default" | "caps";
};

function applyInputState(children: React.ReactNode, inputState: InputState): React.ReactNode {
  if (!React.isValidElement(children)) return children;
  const props = children.props as { inputState?: InputState };
  if (props.inputState && props.inputState !== "enabled") return children;
  return React.cloneElement(children as React.ReactElement<{ inputState?: InputState }>, { inputState });
}

/**
 * Composable field shell — label, required/read-only markers, control slot,
 * chips, error, hint, and link (Figma node 124:9470).
 *
 * Place {@link TextInput}, {@link TextAreaInput}, {@link MobileInput}, or any
 * other control in `children`.
 */
export function InputWrapper({
  label,
  htmlFor,
  required,
  readOnly,
  readOnlyLabel = "(read-only)",
  error,
  hint,
  link,
  chips,
  children,
  className,
  labelStyle = "caps",
}: InputWrapperProps) {
  const control = error ? applyInputState(children, "error") : children;

  return (
    <div className={cn("input-wrapper", className)}>
      {label ? (
        <div className="input-wrapper__label-row">
          <label
            htmlFor={htmlFor}
            className={cn(
              "input-wrapper__label",
              labelStyle === "caps"
                ? "pds-type-caption-s input-wrapper__label--caps"
                : "pds-type-body-s-semibold input-wrapper__label--body"
            )}
          >
            {label}
          </label>
          {required ? <span className="input-wrapper__required" aria-hidden>*</span> : null}
          {readOnly ? (
            <span className="pds-type-body-s-regular input-wrapper__read-only muted">{readOnlyLabel}</span>
          ) : null}
        </div>
      ) : null}

      <div className="input-wrapper__control">{control}</div>

      {chips ? <div className="input-wrapper__chips">{chips}</div> : null}

      {error ? <p className="pds-type-body-m-medium input-wrapper__error">{error}</p> : null}
      {!error && hint ? <p className="pds-type-body-s-regular input-wrapper__hint muted">{hint}</p> : null}
      {link ? <div className="input-wrapper__link">{link}</div> : null}
    </div>
  );
}

/** @deprecated Prefer {@link InputWrapper} with explicit `labelStyle`. Defaults to body label for legacy forms. */
export function FormField(props: InputWrapperProps) {
  return <InputWrapper labelStyle={props.labelStyle ?? "default"} {...props} />;
}

export type FormFieldProps = InputWrapperProps;
