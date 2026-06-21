"use client";

import { Toggle } from "../../../../components/shared/toggle";
import { Icon } from "../../../lib/material-icon";
import "./payroll-config-row.css";

export type PayrollConfigRowIconTone = "blue" | "teal" | "amber" | "red" | "default";

function formatMoney(value: number) {
  return Math.round(value).toLocaleString();
}

export function resolvePayrollRowIconTone(icon: string, kind?: string): PayrollConfigRowIconTone {
  const name = icon.toLowerCase();

  if (kind === "deduction" || name.includes("health") || name.includes("safety") || name.includes("remove")) {
    return "red";
  }
  if (name.includes("bus") || name.includes("direction") || name.includes("transport")) {
    return "teal";
  }
  if (name.includes("restaurant") || name.includes("meal") || name.includes("emoji_events") || name.includes("trophy")) {
    return "amber";
  }
  if (name.includes("home") || name.includes("house") || name.includes("payments")) {
    return "blue";
  }

  return "default";
}

type Props = {
  icon: string;
  iconTone?: PayrollConfigRowIconTone;
  label: string;
  description?: string | null;
  amount: number;
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
  enabled,
  readOnly,
  onToggle
}: Props) {
  return (
    <li className="payroll-staff-config-modal__row">
      <span
        className={[
          "payroll-staff-config-modal__row-icon",
          `payroll-staff-config-modal__row-icon--${iconTone}`
        ].join(" ")}
      >
        <Icon name={icon} size={18} />
      </span>
      <div className="payroll-staff-config-modal__row-label-wrap">
        <p className="payroll-staff-config-modal__row-label">{label}</p>
        {description ? (
          <p className="pds-type-body-s-regular payroll-staff-config-modal__row-description">
            {description}
          </p>
        ) : null}
      </div>
      <div className="payroll-staff-config-modal__row-amount-box">
        <span className="payroll-staff-config-modal__row-amount-value">{formatMoney(amount)}</span>
        <span className="payroll-staff-config-modal__row-amount-currency">MMK</span>
      </div>
      <Toggle
        className="payroll-staff-config-modal__row-toggle"
        checked={enabled}
        disabled={readOnly}
        aria-label={label}
        onCheckedChange={onToggle}
      />
    </li>
  );
}
