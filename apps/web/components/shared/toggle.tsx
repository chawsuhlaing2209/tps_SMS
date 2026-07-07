"use client";

import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "../../lib/utils";

export type ToggleProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
  /** Visible label rendered beside the switch (optional). */
  label?: string;
  /**
   * The surface the toggle sits on — tunes the checked (brand) color for
   * contrast. "primary" for cards/white, "secondary" for layout-secondary fills.
   */
  surface?: "primary" | "secondary";
};

/** Pill toggle for active/inactive settings (brand-green track when on). */
export function Toggle({ className, label, id, surface = "primary", ...props }: ToggleProps) {
  const switchEl = (
    <SwitchPrimitives.Root
      id={id}
      className={cn("form-toggle", surface === "secondary" && "form-toggle--secondary", className)}
      {...props}
    >
      <SwitchPrimitives.Thumb className="form-toggle__thumb" />
    </SwitchPrimitives.Root>
  );

  if (!label) {
    return switchEl;
  }

  return (
    <label className="form-toggle-field" htmlFor={id}>
      <span className="pds-type-body-m-medium form-toggle-field__label">{label}</span>
      {switchEl}
    </label>
  );
}
