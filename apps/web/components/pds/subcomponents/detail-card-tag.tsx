"use client";

import { Icon } from "../../../app/lib/material-icon";
import { cn } from "../../../lib/utils";

export type DetailCardTagProps = {
  label: string;
  icon?: string;
  className?: string;
};

/** Credential / metadata pill on a DetailCard shell surface. */
export function DetailCardTag({ label, icon = "workspace_premium", className }: DetailCardTagProps) {
  return (
    <span className={cn("pds-type-body-s-semibold pds-detail-card-tag", className)}>
      {icon ? <Icon name={icon} size={15} className="pds-detail-card-tag__icon" /> : null}
      {label}
    </span>
  );
}
