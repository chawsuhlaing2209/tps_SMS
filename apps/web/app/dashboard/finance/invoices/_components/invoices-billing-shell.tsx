"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { financeBreadcrumbs } from "../../../../lib/page-header-utils";
import { PageHeader } from "../../../page-header-context";
import {
  InvoicesActionsProvider,
  InvoicesHeaderActionsPortal,
} from "./invoices-actions-provider";
import { InvoicesBillingTabs, type InvoicesBillingTab } from "./invoices-billing-tabs";

type Props = {
  activeTab: InvoicesBillingTab;
  title: string;
  children: ReactNode;
};

export function InvoicesBillingShell({ activeTab, title, children }: Props) {
  const nav = useTranslations("nav");

  return (
    <InvoicesActionsProvider>
      <div className="fees-page">
        <PageHeader
          title={title}
          breadcrumbs={financeBreadcrumbs(nav)}
          actionsPortal={activeTab === "invoices"}
        />

        {activeTab === "invoices" ? <InvoicesHeaderActionsPortal /> : null}

        <InvoicesBillingTabs active={activeTab} />

        {children}
      </div>
    </InvoicesActionsProvider>
  );
}
