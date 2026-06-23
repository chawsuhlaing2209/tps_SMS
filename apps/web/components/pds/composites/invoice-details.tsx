"use client";

import "./invoice-details.css";
import { cn } from "../../../lib/utils";

export type InvoiceDetailsLineVariant = "charge" | "discount" | "credit";

export type InvoiceDetailsLine = {
  id: string;
  label: string;
  sublabel?: string;
  amount: number;
  variant?: InvoiceDetailsLineVariant;
};

export type InvoiceDetailsSection = {
  id: string;
  title: string;
  /** Stronger section divider for discount / paid bands. */
  emphasis?: boolean;
  lines: InvoiceDetailsLine[];
};

export type InvoiceDetailsProps = {
  sections: InvoiceDetailsSection[];
  totalDue: number;
  totalLabel: string;
  currencyLabel?: string;
  formatAmount?: (value: number) => string;
  className?: string;
};

function defaultFormatAmount(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatLineAmount(value: number, variant: InvoiceDetailsLineVariant | undefined, formatAmount: (n: number) => string) {
  const formatted = formatAmount(Math.abs(value));
  if (variant === "discount" || variant === "credit") {
    return `− ${formatted}`;
  }
  return formatted;
}

/** Itemized invoice breakdown — fees, discounts, paid, and total due (Figma 127:8304). */
export function InvoiceDetails({
  sections,
  totalDue,
  totalLabel,
  currencyLabel = "MMK",
  formatAmount = defaultFormatAmount,
  className,
}: InvoiceDetailsProps) {
  return (
    <div className={cn("pds-invoice-details", className)} data-figma-node="127:8304">
      {sections.map((section) => (
        <section key={section.id} aria-label={section.title}>
          <header
            className={cn(
              "pds-invoice-details__section-head",
              section.emphasis && "pds-invoice-details__section-head--primary",
            )}
          >
            <p className="pds-type-caption-s pds-invoice-details__section-title">{section.title}</p>
          </header>
          {section.lines.map((line) => {
            const variant = line.variant ?? "charge";
            return (
              <div key={line.id} className="pds-invoice-details__row">
                <div className="pds-invoice-details__row-label">
                  <p className="pds-type-body-m-medium">{line.label}</p>
                  {line.sublabel ? (
                    <p className="pds-type-body-s-regular pds-invoice-details__row-sublabel">{line.sublabel}</p>
                  ) : null}
                </div>
                <div className="pds-invoice-details__amount">
                  <span
                    className={cn(
                      "pds-type-body-m-bold pds-invoice-details__amount-value",
                      variant === "discount" && "pds-invoice-details__amount-value--discount",
                      variant === "credit" && "pds-invoice-details__amount-value--credit",
                    )}
                  >
                    {formatLineAmount(line.amount, variant, formatAmount)}
                  </span>
                  <span className="pds-type-caption-s pds-invoice-details__amount-currency">{currencyLabel}</span>
                </div>
              </div>
            );
          })}
        </section>
      ))}
      <footer className="pds-invoice-details__total">
        <span className="pds-type-body-m-bold pds-invoice-details__total-label">{totalLabel}</span>
        <div className="pds-invoice-details__total-amount">
          <span className="pds-invoice-details__total-value">{formatAmount(totalDue)}</span>
          <span className="pds-type-caption-s pds-invoice-details__total-currency">{currencyLabel}</span>
        </div>
      </footer>
    </div>
  );
}
