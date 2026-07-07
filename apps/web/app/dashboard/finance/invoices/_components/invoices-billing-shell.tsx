"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { moduleBreadcrumbs } from "../../../../lib/page-header-utils";
import type { DashboardNavKey } from "../../../../lib/permissions";
import { PageHeader } from "../../../page-header-context";
import {
  InvoicesActionsProvider,
  InvoicesHeaderActionsPortal,
} from "./invoices-actions-provider";

type Props = {
  /** Top-level nav item this page lives under ("invoices" or "collection"). */
  navKey: DashboardNavKey;
  title: string;
  children: ReactNode;
  /** Generate + Create Invoice in the title row (invoices page only). */
  showHeaderActions?: boolean;
  /** Enable title-row portal for export actions (collection page). */
  actionsPortal?: boolean;
};

export function InvoicesBillingShell({
  navKey,
  title,
  children,
  showHeaderActions = false,
  actionsPortal = showHeaderActions
}: Props) {
  const nav = useTranslations("nav");

  return (
    <InvoicesActionsProvider>
      <div className="fees-page">
        <PageHeader
          title={title}
          breadcrumbs={moduleBreadcrumbs(navKey, nav)}
          actionsPortal={actionsPortal}
        />

        {showHeaderActions ? <InvoicesHeaderActionsPortal /> : null}

        {children}
      </div>
    </InvoicesActionsProvider>
  );
}
