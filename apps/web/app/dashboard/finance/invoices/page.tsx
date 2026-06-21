"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { InvoicesBillingShell } from "./_components/invoices-billing-shell";
import { WorkspaceLoading } from "../../../lib/workspace-loading";

const InvoicesListPanel = dynamic(
  () => import("./_components/invoices-list-panel").then((module) => module.InvoicesListPanel),
  { loading: () => <WorkspaceLoading /> }
);

export default function InvoicesPage() {
  const t = useTranslations("finance.invoiceList");

  return (
    <InvoicesBillingShell showHeaderActions title={t("title")}>
      <InvoicesListPanel />
    </InvoicesBillingShell>
  );
}
