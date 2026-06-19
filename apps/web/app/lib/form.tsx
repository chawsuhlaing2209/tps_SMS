"use client";

import type { ReactNode } from "react";
import { FormField } from "../../components/shared/form-input";

/** @deprecated Prefer `FormField` from `components/shared/form-input`. Thin alias for legacy call sites. */
export function Field({
  label,
  error,
  children
}: {
  label?: string;
  error?: string;
  children: ReactNode;
}) {
  if (!label) {
    return (
      <div className="pds-type-body-s-semibold form-field form-field--unlabeled">
        {children}
        {error ? <span className="pds-type-body-s-regular field-error">{error}</span> : null}
      </div>
    );
  }

  return (
    <FormField label={label} error={error}>
      {children}
    </FormField>
  );
}
