"use client";

import type { EnrollmentPreviewDiscountOption } from "@sms/shared";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import { Toggle } from "../../shared/toggle";
import { Divider } from "../subcomponents/divider";
import { formatToggleListAmount, ToggleListSectionHead } from "./toggle-list";
import "./discount-toggle-list.css";

export type DiscountToggleListItemProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  amount: number;
  currency?: string;
  badge: ReactNode;
  badgeTone: "auto" | "eligible" | "ineligible";
  checked: boolean;
  disabled?: boolean;
  applied?: boolean;
  ariaLabel?: string;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
};

export function DiscountToggleListItem({
  title,
  subtitle,
  amount,
  currency = "MMK",
  badge,
  badgeTone,
  checked,
  disabled = false,
  applied = false,
  ariaLabel,
  onCheckedChange,
  className,
}: DiscountToggleListItemProps) {
  return (
    <li
      className={cn(
        "pds-discount-toggle-list__item",
        applied ? "pds-discount-toggle-list__item--applied" : "pds-discount-toggle-list__item--available",
        className,
      )}
    >
      <div className="pds-discount-toggle-list__copy">
        <div className="pds-discount-toggle-list__main">
          <div className="pds-discount-toggle-list__title-row">
            <p className="pds-type-body-s-bold pds-discount-toggle-list__title">{title}</p>
            <span
              className={cn(
                "pds-type-body-s-bold pds-discount-toggle-list__badge",
                `pds-discount-toggle-list__badge--${badgeTone}`,
              )}
            >
              {badge}
            </span>
          </div>
          {subtitle ? (
            <p className="pds-type-body-s-regular pds-discount-toggle-list__subtitle">{subtitle}</p>
          ) : null}
        </div>
        <span className="pds-discount-toggle-list__amount">
          <span
            className={cn(
              "pds-type-body-m-bold pds-discount-toggle-list__amount-value",
              !checked && "pds-discount-toggle-list__amount-value--muted",
            )}
          >
            − {formatToggleListAmount(amount)}
          </span>
          <span className="pds-type-caption-s pds-discount-toggle-list__amount-currency">{currency}</span>
        </span>
      </div>
      <Toggle
        className="pds-discount-toggle-list__toggle"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)}
        onCheckedChange={onCheckedChange}
      />
    </li>
  );
}

export function DiscountToggleList({
  children,
  className,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <ul className={cn("pds-discount-toggle-list", className)} aria-label={ariaLabel}>
      {children}
    </ul>
  );
}

export function DiscountToggleListTotal({
  label,
  amount,
  currency = "MMK",
  className,
}: {
  label: ReactNode;
  amount: number;
  currency?: string;
  className?: string;
}) {
  return (
    <div className={cn("pds-discount-toggle-list__total", className)}>
      <p className="pds-type-body-m-bold pds-discount-toggle-list__total-label">{label}</p>
      <p className="pds-discount-toggle-list__total-value">
        <span className="pds-type-title-xl-extrabold pds-discount-toggle-list__total-amount">
          − {formatToggleListAmount(amount)}
        </span>
        <span className="pds-type-caption-s pds-discount-toggle-list__total-currency">{currency}</span>
      </p>
    </div>
  );
}

export function mapDiscountOptionBadge(
  option: EnrollmentPreviewDiscountOption,
  labels: {
    autoApplied: string;
    eligible: string;
    notEligible: string;
  },
): { label: string; tone: DiscountToggleListItemProps["badgeTone"] } {
  if (option.eligibility === "auto_applied") {
    return { label: labels.autoApplied, tone: "auto" };
  }
  if (option.eligibility === "eligible") {
    return { label: labels.eligible, tone: "eligible" };
  }
  return { label: labels.notEligible, tone: "ineligible" };
}

export function DiscountToggleListSectionHead(props: {
  title: ReactNode;
  summary?: ReactNode;
  className?: string;
}) {
  return <ToggleListSectionHead {...props} />;
}

export function DiscountToggleListIntro({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn("pds-type-body-s-regular pds-discount-toggle-list__intro", className)}>{children}</p>;
}

export { Divider as DiscountToggleListDivider };
