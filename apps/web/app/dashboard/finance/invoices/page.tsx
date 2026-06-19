"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { InvoicesBillingShell } from "./_components/invoices-billing-shell";
import { InvoicesListPanel } from "./_components/invoices-list-panel";

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
