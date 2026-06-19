"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { financeBreadcrumbs } from "../../../lib/page-header-utils";
import { PageHeader } from "../../page-header-context";
import {
  InvoicesActionsProvider,
  InvoicesHeaderActionsPortal,
} from "./_components/invoices-actions-provider";
import { CollectionRosterPanel } from "./_components/collection-roster-panel";
import { InvoicesListPanel } from "./_components/invoices-list-panel";

type FinanceView = "invoices" | "collection";

export default function InvoicesPage() {
  const t = useTranslations("finance.invoiceList");
  const tFees = useTranslations("finance.feesBilling");
  const nav = useTranslations("nav");
  const searchParams = useSearchParams();

  const view: FinanceView = useMemo(() => {
    const param = searchParams.get("view");
    return param === "collection" ? "collection" : "invoices";
  }, [searchParams]);

  return (
    <InvoicesActionsProvider>
      <div className="fees-page">
        <PageHeader
          title={t("title")}
          breadcrumbs={financeBreadcrumbs(nav)}
          actionsPortal={view === "invoices"}
        />

        {view === "invoices" ? <InvoicesHeaderActionsPortal /> : null}

        <nav className="fees-view-toggle" aria-label={tFees("viewToggleLabel")}>
          <a
            href="/dashboard/finance/invoices"
            className={
              view === "invoices"
                ? "fees-view-toggle__link fees-view-toggle__link--active"
                : "fees-view-toggle__link"
            }
            aria-current={view === "invoices" ? "page" : undefined}
          >
            {tFees("invoicesView")}
          </a>
          <a
            href="/dashboard/finance/invoices?view=collection"
            className={
              view === "collection"
                ? "fees-view-toggle__link fees-view-toggle__link--active"
                : "fees-view-toggle__link"
            }
            aria-current={view === "collection" ? "page" : undefined}
          >
            {tFees("collectionView")}
          </a>
        </nav>

        {view === "collection" ? <CollectionRosterPanel /> : <InvoicesListPanel />}
      </div>
    </InvoicesActionsProvider>
  );
}
