import { redirect } from "next/navigation";

export default function BillingRedirect() {
  redirect("/dashboard/finance/invoices?view=collection");
}
