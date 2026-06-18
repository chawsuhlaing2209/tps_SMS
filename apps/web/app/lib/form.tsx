"use client";

import type { ReactNode } from "react";

/** Labeled form control with an inline validation message. Omit `label` for unlabeled controls (use aria-label on the child). */
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
      <div className="form-field form-field--unlabeled">
        {children}
        {error ? <span className="field-error">{error}</span> : null}
      </div>
    );
  }

  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}
