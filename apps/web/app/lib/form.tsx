"use client";

import type { ReactNode } from "react";
import { InputWrapper } from "../../components/shared/input-wrapper";

/** @deprecated Prefer `InputWrapper` from `components/shared/input-wrapper`. Thin alias for legacy call sites. */
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
    <InputWrapper label={label} error={error} labelStyle="default">
      {children}
    </InputWrapper>
  );
}
