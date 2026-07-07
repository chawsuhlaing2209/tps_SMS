"use client";

import { use } from "react";
import { InvoiceDetailView } from "../_components/invoice-detail-view";

export default function InvoiceDetailPage({
  params
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = use(params);
  return <InvoiceDetailView invoiceId={invoiceId} variant="page" />;
}
