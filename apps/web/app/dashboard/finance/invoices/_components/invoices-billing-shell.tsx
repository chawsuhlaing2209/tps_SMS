"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { financeBreadcrumbs } from "../../../../lib/page-header-utils";
import { PageHeader } from "../../../page-header-context";
import {
  InvoicesActionsProvider,
  InvoicesHeaderActionsPortal,
} from "./invoices-actions-provider";

type Props = {
  title: string;
  children: ReactNode;
  /** Generate + Create Invoice in the title row (invoices page only). */
  showHeaderActions?: boolean;
  /** Enable title-row portal for export actions (collection page). */
  actionsPortal?: boolean;
};

export function InvoicesBillingShell({
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
          breadcrumbs={financeBreadcrumbs(nav)}
          actionsPortal={actionsPortal}
        />

        {showHeaderActions ? <InvoicesHeaderActionsPortal /> : null}

        {children}
      </div>
    </InvoicesActionsProvider>
  );
}
