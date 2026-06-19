"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { InvoicesBillingShell } from "./_components/invoices-billing-shell";
import { WorkspaceLoading } from "../../../lib/workspace-loading";

const InvoicesListPanel = dynamic(
  () => import("./_components/invoices-list-panel").then((module) => module.InvoicesListPanel),
  { loading: () => <WorkspaceLoading /> }
);

export default function InvoicesPage() {
  const t = useTranslations("finance.invoiceList");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("view") === "collection") {
      router.replace("/dashboard/finance/billing");
    }
  }, [router, searchParams]);

  return (
    <InvoicesBillingShell activeTab="invoices" title={t("title")}>
      <InvoicesListPanel />
    </InvoicesBillingShell>
  );
}
