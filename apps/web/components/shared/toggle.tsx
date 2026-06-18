"use client";

import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "../../lib/utils";

export type ToggleProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
  /** Visible label rendered beside the switch (optional). */
  label?: string;
};

/** Pill toggle for active/inactive settings (ink-green track when on). */
export function Toggle({ className, label, id, ...props }: ToggleProps) {
  const switchEl = (
    <SwitchPrimitives.Root
      id={id}
      className={cn("form-toggle", className)}
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
      <span className="form-toggle-field__label">{label}</span>
      {switchEl}
    </label>
  );
}
