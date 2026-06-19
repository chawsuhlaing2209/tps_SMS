"use client";

import { PdsDatePicker, type PdsDatePickerProps } from "../composites/date-picker";

export type PdsDatePickerFieldProps = PdsDatePickerProps;

/** Thin field wrapper around {@link PdsDatePicker}. */
export function PdsDatePickerField(props: PdsDatePickerFieldProps) {
  return <PdsDatePicker {...props} />;
}
