"use client";

import * as React from "react";
import { clampPercentString } from "@sms/shared";
import { cn } from "../../lib/utils";
import { Icon } from "../../app/lib/material-icon";
import { PdsSelectField, type SelectFieldOption } from "../pds/fields/select-field";
import { PdsDatePickerField, type PdsDatePickerFieldProps } from "../pds/fields/date-picker-field";
import type { InputState } from "./input-types";
import { inputStateClass } from "./input-types";

export type { InputState } from "./input-types";
export {
  FormField,
  InputWrapper,
  InputChip,
  InputChipGroup,
  type FormFieldProps,
  type InputWrapperProps,
  type InputChipProps,
} from "./input-wrapper";

export type TextInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  inputClassName?: string;
  /** Maps to Figma Text input states. Hover/focus handled in CSS. */
  inputState?: InputState;
  /** Trailing unit or hint inside the control border (e.g. "MMK / mo"). */
  suffix?: React.ReactNode;
  /** Render only the native input — no `.text-input` shell (e.g. pay modal amount field). */
  unwrapped?: boolean;
};

/** Single-line text control — swap content for {@link InputWrapper} (Figma 124:8752). */
export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      className,
      inputClassName,
      type = "text",
      inputState = "enabled",
      disabled,
      suffix,
      unwrapped = false,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || inputState === "disabled";

    if (unwrapped) {
      return (
        <input
          ref={ref}
          type={type}
          disabled={isDisabled}
          className={cn(
            "pds-type-body-m-medium form-input",
            inputStateClass(inputState, isDisabled),
            className,
            inputClassName
          )}
          aria-invalid={inputState === "error" ? true : undefined}
          {...props}
        />
      );
    }

    return (
      <div className={cn("text-input", suffix && "text-input--suffix", className)}>
        <input
          ref={ref}
          type={type}
          disabled={isDisabled}
          className={cn(
            "pds-type-body-m-medium form-input text-input__field",
            inputStateClass(inputState, isDisabled),
            inputClassName
          )}
          aria-invalid={inputState === "error" ? true : undefined}
          {...props}
        />
        {suffix ? <span className="pds-type-body-s-semibold text-input__suffix">{suffix}</span> : null}
      </div>
    );
  }
);
TextInput.displayName = "TextInput";

/** @deprecated Prefer {@link TextInput}. */
export const FormInput = TextInput;
export type FormInputProps = TextInputProps;

export type TextAreaInputProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  textareaClassName?: string;
  inputState?: InputState;
  /** Leading language/locale tag (Figma TextArea sm/lg). */
  languageTag?: string;
  /** Show character counter when `maxLength` is set. */
  showCount?: boolean;
  size?: "sm" | "lg";
};

/** Multi-line text control — swap content for {@link InputWrapper} (Figma 124:8799). */
export const TextAreaInput = React.forwardRef<HTMLTextAreaElement, TextAreaInputProps>(
  (
    {
      className,
      textareaClassName,
      rows,
      inputState = "enabled",
      disabled,
      languageTag,
      showCount = true,
      size = "sm",
      maxLength,
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || inputState === "disabled";
    const [length, setLength] = React.useState(() => {
      const initial = value ?? defaultValue;
      return typeof initial === "string" ? initial.length : 0;
    });

    React.useEffect(() => {
      if (typeof value === "string") setLength(value.length);
    }, [value]);

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLength(event.target.value.length);
      onChange?.(event);
    };

    const counter = maxLength != null && showCount ? `${length}/${maxLength}` : null;

    return (
      <div
        className={cn(
          "text-area-input",
          `text-area-input--${size}`,
          inputState === "error" && "text-area-input--error",
          isDisabled && "text-area-input--disabled",
          className
        )}
      >
        {languageTag ? (
          <div className="text-area-input__lang" aria-hidden>
            <span className="pds-type-caption-s text-area-input__lang-label">{languageTag}</span>
          </div>
        ) : null}
        <div className="text-area-input__body">
          <div className="text-area-input__content">
            <textarea
              ref={ref}
              rows={rows}
              disabled={isDisabled}
              maxLength={maxLength}
              value={value}
              defaultValue={defaultValue}
              onChange={handleChange}
              className={cn("pds-type-body-m-medium text-area-input__field", textareaClassName)}
              aria-invalid={inputState === "error" ? true : undefined}
              {...props}
            />
            {counter ? (
              <span className="pds-type-body-s-regular text-area-input__count">{counter}</span>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
);
TextAreaInput.displayName = "TextAreaInput";

/** @deprecated Prefer {@link TextAreaInput}. */
export const FormTextarea = TextAreaInput;
export type FormTextareaProps = TextAreaInputProps;

export type MobileInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "type"> & {
  inputClassName?: string;
  inputState?: InputState;
  countryCode?: string;
  countryLabel?: string;
  /** Show trailing clear control when the field has a value. */
  clearable?: boolean;
  onClear?: () => void;
};

/** Phone number control with country prefix — swap content for {@link InputWrapper} (Figma 124:8648). */
export const MobileInput = React.forwardRef<HTMLInputElement, MobileInputProps>(
  (
    {
      className,
      inputClassName,
      inputState = "enabled",
      disabled,
      countryCode = "+95",
      countryLabel = "Myanmar",
      clearable,
      onClear,
      value,
      defaultValue,
      onChange,
      placeholder = "9XXXXXXXX",
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || inputState === "disabled";
    const [internalValue, setInternalValue] = React.useState(
      typeof defaultValue === "string" ? defaultValue : ""
    );
    const currentValue = value !== undefined ? String(value) : internalValue;
    const showClear = clearable && currentValue.length > 0 && !isDisabled;

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (value === undefined) setInternalValue(event.target.value);
      onChange?.(event);
    };

    const handleClear = () => {
      if (value === undefined) setInternalValue("");
      onClear?.();
    };

    return (
      <div
        className={cn(
          "mobile-input",
          inputState === "error" && "mobile-input--error",
          isDisabled && "mobile-input--disabled",
          className
        )}
      >
        <div className="mobile-input__prefix" aria-label={countryLabel}>
          <span className="mobile-input__flag" aria-hidden>
            🇲🇲
          </span>
          <span className="pds-type-body-m-medium mobile-input__code">{countryCode}</span>
        </div>
        <input
          ref={ref}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          disabled={isDisabled}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          onChange={handleChange}
          className={cn("pds-type-body-m-medium mobile-input__field", inputClassName)}
          aria-invalid={inputState === "error" ? true : undefined}
          {...props}
        />
        {showClear ? (
          <button type="button" className="mobile-input__clear" onClick={handleClear} aria-label="Clear phone number">
            <Icon name="close" size={18} />
          </button>
        ) : null}
      </div>
    );
  }
);
MobileInput.displayName = "MobileInput";

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

export type PercentInputProps = Omit<TextInputProps, "type" | "suffix"> & {
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
  onChange,
  ...props
}: PercentInputProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const clamped = clampPercentString(event.target.value);
    if (clamped !== event.target.value) {
      event.target.value = clamped;
    }
    onChange?.(event);
  };

  return (
    <div className={cn("percent-input", compact && "percent-input--compact", className)}>
      <TextInput
        type="number"
        min={0}
        max={100}
        step={1}
        inputState={inputState}
        inputClassName={cn("pds-type-body-l-medium percent-input__field", inputClassName)}
        onChange={handleChange}
        {...props}
      />
      <span className="pds-type-body-m-medium percent-input__suffix">{suffixText}</span>
    </div>
  );
}
