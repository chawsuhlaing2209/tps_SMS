"use client";

import {
  ToggleListItem,
  resolveToggleListIconTone,
  type ToggleListIconTone,
} from "../../../../components/pds/composites/toggle-list";
import "./payroll-config-row.css";

export type PayrollConfigRowIconTone = "blue" | "teal" | "amber" | "red" | "default";

function mapPayrollToneToToggleListTone(tone: PayrollConfigRowIconTone): ToggleListIconTone {
  switch (tone) {
    case "blue":
      return "info";
    case "teal":
      return "success";
    case "amber":
      return "warning";
    case "red":
      return "error";
    default:
      return "default";
  }
}

export function resolvePayrollRowIconTone(icon: string, kind?: string): PayrollConfigRowIconTone {
  const tone = resolveToggleListIconTone(icon, kind);
  switch (tone) {
    case "info":
      return "blue";
    case "success":
      return "teal";
    case "warning":
      return "amber";
    case "error":
      return "red";
    default:
      return "default";
  }
}

type Props = {
  icon: string;
  iconTone?: PayrollConfigRowIconTone;
  label: string;
  description?: string | null;
  amount: number;
  currency?: string;
  enabled: boolean;
  readOnly: boolean;
  onToggle: (checked: boolean) => void;
};

export function PayrollConfigRow({
  icon,
  iconTone = "default",
  label,
  description,
  amount,
  currency = "MMK",
  enabled,
  readOnly,
  onToggle,
}: Props) {
  return (
    <ToggleListItem
      variant="toggle"
      icon={icon}
      iconTone={mapPayrollToneToToggleListTone(iconTone)}
      title={label}
      description={description ?? undefined}
      amount={amount}
      currency={currency}
      checked={enabled}
      readOnly={readOnly}
      ariaLabel={label}
      onCheckedChange={onToggle}
    />
  );
}
