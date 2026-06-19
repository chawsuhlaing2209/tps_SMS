"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { InvoicesBillingShell } from "../invoices/_components/invoices-billing-shell";
import { WorkspaceLoading } from "../../../lib/workspace-loading";

const CollectionRosterPanel = dynamic(
  () =>
    import("../invoices/_components/collection-roster-panel").then(
      (module) => module.CollectionRosterPanel
    ),
  { loading: () => <WorkspaceLoading /> }
);

export default function BillingCollectionPage() {
  const tFees = useTranslations("finance.feesBilling");

  return (
    <InvoicesBillingShell activeTab="collection" title={tFees("collectionView")}>
      <CollectionRosterPanel />
    </InvoicesBillingShell>
  );
}
