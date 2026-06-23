"use client";

import type { EnrollmentPreviewResult } from "@sms/shared";
import type { InvoiceDetailsSection } from "../../../components/pds/composites/invoice-details";
import {
  resolveToggleListIconTone,
  type ToggleListIconTone,
} from "../../../components/pds/composites/toggle-list";
import { Icon } from "../../lib/material-icon";
import { cn } from "../../../lib/utils";

export function studentInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatEnrollmentAmount(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

export function buildEnrollmentInvoiceDetails(
  preview: EnrollmentPreviewResult,
  labels: {
    previewHeader: string;
    discountSection: string;
    paidSection: string;
    paidToDate: string;
  },
  placementLabel?: string,
): InvoiceDetailsSection[] {
  const header = placementLabel ?? labels.previewHeader;

  const feeLines: InvoiceDetailsSection = {
    id: "fees",
    title: header,
    lines: preview.feeLines.map((line) => ({
      id: line.planId ?? line.feeItemId,
      label: line.description,
      amount: line.lineTotal,
    })),
  };

  const sections: InvoiceDetailsSection[] = [feeLines];

  if (preview.discounts.length > 0) {
    sections.push({
      id: "discounts",
      title: labels.discountSection,
      emphasis: true,
      lines: preview.discounts.map((discount) => ({
        id: `${discount.source}-${discount.id}`,
        label: discount.name,
        amount: discount.amount,
        variant: "discount" as const,
      })),
    });
  }

  sections.push({
    id: "paid",
    title: labels.paidSection,
    emphasis: true,
    lines: [
      {
        id: "paid-to-date",
        label: labels.paidToDate,
        amount: 0,
        variant: "credit",
      },
    ],
  });

  return sections;
}

export function EnrollmentStudentBanner({
  name,
  meta,
  badge,
  className,
}: {
  name: string;
  meta?: string | null;
  badge?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("enrollment-student-banner", className)}>
      <span className="enrollment-student-banner__avatar" aria-hidden>
        {studentInitials(name)}
      </span>
      <div className="enrollment-student-banner__main">
        <p className="pds-type-body-m-bold enrollment-student-banner__name">{name}</p>
        {meta ? <p className="pds-type-body-s-regular enrollment-student-banner__meta">{meta}</p> : null}
      </div>
      {badge ? <span className="enrollment-student-banner__badge">{badge}</span> : null}
    </div>
  );
}

export function EnrollmentChip({
  selected,
  disabled,
  onClick,
  children,
  className,
}: {
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn("enrollment-chip", selected && "enrollment-chip--selected", className)}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
    >
      {children}
    </button>
  );
}

export function resolveOptionalFeeIcon(name: string, feeType?: string) {
  const label = `${name} ${feeType ?? ""}`.toLowerCase();

  if (label.includes("board") || label.includes("hostel") || label.includes("dorm")) {
    return { icon: "bed", tone: "info" as ToggleListIconTone };
  }
  if (label.includes("transport") || label.includes("bus")) {
    return { icon: "directions_bus", tone: "success" as ToggleListIconTone };
  }
  if (label.includes("meal") || label.includes("lunch") || label.includes("food")) {
    return { icon: "restaurant", tone: "warning" as ToggleListIconTone };
  }
  if (label.includes("care") || label.includes("health") || label.includes("safety")) {
    return { icon: "health_and_safety", tone: "error" as ToggleListIconTone };
  }

  return { icon: "inventory_2", tone: resolveToggleListIconTone(name, feeType) };
}

export function EnrollmentConfirmOption({
  icon,
  title,
  hint,
  selected,
  onSelect,
}: {
  icon: string;
  title: string;
  hint: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn("enrollment-confirm-option", selected && "enrollment-confirm-option--selected")}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="enrollment-confirm-option__icon" aria-hidden>
        <Icon name={icon} size={19} />
      </span>
      <div className="enrollment-confirm-option__copy">
        <p className="pds-type-body-m-bold">{title}</p>
        <p className="pds-type-body-s-regular enrollment-confirm-option__hint">{hint}</p>
      </div>
    </button>
  );
}
