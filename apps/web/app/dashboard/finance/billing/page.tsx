"use client";

import { useTranslations } from "next-intl";
import { CollectionRosterPanel } from "../invoices/_components/collection-roster-panel";
import { InvoicesBillingShell } from "../invoices/_components/invoices-billing-shell";

export default function BillingCollectionPage() {
  const tFees = useTranslations("finance.feesBilling");

  return (
    <InvoicesBillingShell activeTab="collection" title={tFees("collectionView")}>
      <CollectionRosterPanel />
    </InvoicesBillingShell>
  );
}
