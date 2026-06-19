"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

export type InvoicesBillingTab = "invoices" | "collection";

type Props = {
  active: InvoicesBillingTab;
};

export function InvoicesBillingTabs({ active }: Props) {
  const tFees = useTranslations("finance.feesBilling");

  return (
    <nav className="fees-view-toggle" aria-label={tFees("viewToggleLabel")}>
      <Link
        href="/dashboard/finance/invoices"
        className={
          active === "invoices"
            ? "fees-view-toggle__link fees-view-toggle__link--active"
            : "fees-view-toggle__link"
        }
        aria-current={active === "invoices" ? "page" : undefined}
      >
        {tFees("invoicesView")}
      </Link>
      <Link
        href="/dashboard/finance/billing"
        className={
          active === "collection"
            ? "fees-view-toggle__link fees-view-toggle__link--active"
            : "fees-view-toggle__link"
        }
        aria-current={active === "collection" ? "page" : undefined}
      >
        {tFees("collectionView")}
      </Link>
    </nav>
  );
}
