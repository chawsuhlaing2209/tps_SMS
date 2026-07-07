"use client";

import "./invoice.css";
import type { ReactNode } from "react";
import { Icon } from "../../../app/lib/material-icon";
import { cn } from "../../../lib/utils";
import { InvoiceDetails, type InvoiceDetailsProps } from "./invoice-details";
import { ModalHeaderShell } from "./modal-header-shell";

export type InvoiceAction = {
  id: string;
  label: string;
  icon?: string;
  variant?: "outline" | "primary";
  disabled?: boolean;
  onClick?: () => void;
};

export type InvoiceProps = {
  schoolName: string;
  schoolContact?: string | null;
  /** School logo shown in the ink header; falls back to the brand mark. */
  logoUrl?: string | null;
  billedToLabel: string;
  studentName: string;
  studentMeta?: string | null;
  documentTitle: string;
  invoiceNumber: string;
  dueLabel?: string | null;
  details: Omit<InvoiceDetailsProps, "className">;
  actions?: InvoiceAction[];
  onClose?: () => void;
  closeLabel?: string;
  children?: ReactNode;
  className?: string;
  id?: string;
};

/** Full invoice document — ink header, billed-to meta, itemized details, optional actions (Figma 127:16147). */
export function Invoice({
  schoolName,
  schoolContact,
  logoUrl,
  billedToLabel,
  studentName,
  studentMeta,
  documentTitle,
  invoiceNumber,
  dueLabel,
  details,
  actions,
  onClose,
  closeLabel,
  children,
  className,
  id,
}: InvoiceProps) {
  return (
    <article className={cn("pds-invoice", className)} id={id} data-figma-node="127:16147">
      <ModalHeaderShell
        variant="invoice"
        title={schoolName}
        description={schoolContact}
        logoUrl={logoUrl}
        onClose={onClose}
        closeLabel={closeLabel}
      />

      <div className="pds-invoice__body">
        <div className="pds-invoice__meta">
          <div className="pds-invoice__billed">
            <p className="pds-type-caption-s pds-invoice__eyebrow">{billedToLabel}</p>
            <p className="pds-type-body-m-bold pds-invoice__student">{studentName}</p>
            {studentMeta ? (
              <p className="pds-type-body-s-regular pds-invoice__billed-meta">{studentMeta}</p>
            ) : null}
          </div>
          <div className="pds-invoice__ref">
            <p className="pds-type-title-s-extrabold pds-invoice__doc-title">{documentTitle}</p>
            <p className="pds-type-body-s-semibold pds-invoice__number">{invoiceNumber}</p>
            {dueLabel ? <p className="pds-type-body-s-semibold pds-invoice__due">{dueLabel}</p> : null}
          </div>
        </div>

        <InvoiceDetails {...details} />

        {children ? <div className="pds-invoice__extra">{children}</div> : null}
      </div>

      {actions?.length ? (
        <footer className="pds-invoice__actions">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={cn(
                "pds-type-body-m-bold pds-invoice__action",
                action.variant === "primary" ? "pds-invoice__action--primary" : "pds-invoice__action--outline",
              )}
              disabled={action.disabled}
              onClick={action.onClick}
            >
              {action.icon ? <Icon name={action.icon} size={17} /> : null}
              {action.label}
            </button>
          ))}
        </footer>
      ) : null}
    </article>
  );
}

export { InvoiceDetails };
export type { InvoiceDetailsProps, InvoiceDetailsSection, InvoiceDetailsLine } from "./invoice-details";
