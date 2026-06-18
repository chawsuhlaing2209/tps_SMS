"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

/** Figma Input states: enabled, hovered (CSS), disabled, Completed, error. */
export type InputState = "enabled" | "disabled" | "completed" | "error";

export type FormInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  inputClassName?: string;
  /** Maps to Figma Input component states. Hover/focus handled in CSS. */
  inputState?: InputState;
};

function inputStateClass(state: InputState | undefined, disabled?: boolean): string {
  if (disabled || state === "disabled") return "form-input--disabled";
  if (state === "error") return "form-input--error";
  if (state === "completed") return "form-input--completed";
  return "";
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ className, inputClassName, type = "text", inputState = "enabled", disabled, ...props }, ref) => {
    const isDisabled = disabled || inputState === "disabled";

    return (
      <div className={cn("form-input-wrap", className)}>
        <input
          ref={ref}
          type={type}
          disabled={isDisabled}
          className={cn("form-input", inputStateClass(inputState, isDisabled), inputClassName)}
          aria-invalid={inputState === "error" ? true : undefined}
          {...props}
        />
      </div>
    );
  }
);
FormInput.displayName = "FormInput";

export type FormTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  textareaClassName?: string;
  inputState?: InputState;
};

export const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ className, textareaClassName, rows = 3, inputState = "enabled", disabled, ...props }, ref) => {
    const isDisabled = disabled || inputState === "disabled";

    return (
      <textarea
        ref={ref}
        rows={rows}
        disabled={isDisabled}
        className={cn(
          "form-input form-input--textarea",
          inputStateClass(inputState, isDisabled),
          textareaClassName,
          className
        )}
        aria-invalid={inputState === "error" ? true : undefined}
        {...props}
      />
    );
  }
);
FormTextarea.displayName = "FormTextarea";

export type FormSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  selectClassName?: string;
  inputState?: InputState;
};

export const FormSelect = React.forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ className, selectClassName, children, inputState = "enabled", disabled, ...props }, ref) => {
    const isDisabled = disabled || inputState === "disabled";

    return (
      <select
        ref={ref}
        disabled={isDisabled}
        className={cn(
          "form-input form-input--select",
          inputStateClass(inputState, isDisabled),
          selectClassName,
          className
        )}
        aria-invalid={inputState === "error" ? true : undefined}
        {...props}
      >
        {children}
      </select>
    );
  }
);
FormSelect.displayName = "FormSelect";

export type FormFieldProps = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  labelStyle?: "default" | "caps";
  suffix?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/** Labeled field shell matching Figma Input (caption label + control + error message). */
export function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  labelStyle = "default",
  suffix,
  children,
  className,
}: FormFieldProps) {
  const control =
    error && React.isValidElement(children)
      ? React.cloneElement(children as React.ReactElement<{ inputState?: InputState }>, {
          inputState: "error",
        })
      : children;

  return (
    <div className={cn("form-field-block", className)}>
      <label
        htmlFor={htmlFor}
        className={cn("form-field-block__label", labelStyle === "caps" && "form-field-block__label--caps")}
      >
        {label}
        {required ? <span className="form-field-block__required"> *</span> : null}
      </label>
      <div className={cn("form-field-block__control", suffix && "form-field-block__control--suffix")}>
        {control}
        {suffix ? <span className="form-field-block__suffix">{suffix}</span> : null}
      </div>
      {hint ? <p className="form-field-block__hint muted">{hint}</p> : null}
      {error ? <p className="form-field-block__error">{error}</p> : null}
    </div>
  );
}

export type PercentInputProps = Omit<FormInputProps, "type" | "suffix"> & {
  suffixText?: string;
  compact?: boolean;
};

/** Percentage control used on discount cards and sheets. */
export function PercentInput({
  suffixText = "%",
  compact,
  className,
  inputClassName,
  inputState,
  ...props
}: PercentInputProps) {
  return (
    <div className={cn("percent-input", compact && "percent-input--compact", className)}>
      <FormInput
        type="number"
        min={0}
        max={100}
        step={1}
        inputState={inputState}
        inputClassName={cn("percent-input__field", inputClassName)}
        {...props}
      />
      <span className="percent-input__suffix">{suffixText}</span>
    </div>
  );
}
