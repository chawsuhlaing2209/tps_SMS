"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { PdsSelectField, type SelectFieldOption } from "../pds/fields/select-field";
import { PdsDatePickerField, type PdsDatePickerFieldProps } from "../pds/fields/date-picker-field";

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
          className={cn("pds-type-body-m-medium form-input", inputStateClass(inputState, isDisabled), inputClassName)}
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
          "pds-type-body-m-medium form-input form-input--textarea",
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

export type FormSelectProps = {
  options: SelectFieldOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  selectClassName?: string;
  inputState?: InputState;
  disabled?: boolean;
  className?: string;
  variant?: "form" | "filter";
};

export function FormSelect({
  options,
  value,
  onValueChange,
  placeholder,
  selectClassName,
  inputState = "enabled",
  disabled,
  className,
  variant = "form",
}: FormSelectProps) {
  return (
    <div className={cn("form-input-wrap", className)}>
      <PdsSelectField
        className={selectClassName}
        options={options}
        value={value}
        onValueChange={(next) => onValueChange?.(typeof next === "string" ? next : "")}
        placeholder={placeholder}
        inputState={inputState}
        disabled={disabled}
        variant={variant}
      />
    </div>
  );
}

export type FormDatePickerProps = PdsDatePickerFieldProps;

export function FormDatePicker(props: FormDatePickerProps) {
  return <PdsDatePickerField {...props} />;
}

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
        className={cn("pds-type-body-m-medium form-field-block__label", labelStyle === "caps" && "pds-type-caption-s form-field-block__label--caps")}
      >
        {label}
        {required ? <span className="form-field-block__required"> *</span> : null}
      </label>
      <div className={cn("form-field-block__control", suffix && "form-field-block__control--suffix")}>
        {control}
        {suffix ? <span className="pds-type-body-m-medium form-field-block__suffix">{suffix}</span> : null}
      </div>
      {hint ? <p className="pds-type-body-s-regular form-field-block__hint muted">{hint}</p> : null}
      {error ? <p className="pds-type-body-s-regular form-field-block__error">{error}</p> : null}
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
        inputClassName={cn("pds-type-body-l-medium pds-type-body-l-medium percent-input__field", inputClassName)}
        {...props}
      />
      <span className="pds-type-body-m-medium percent-input__suffix">{suffixText}</span>
    </div>
  );
}
