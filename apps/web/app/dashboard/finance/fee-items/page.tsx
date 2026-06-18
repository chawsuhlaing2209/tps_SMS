import { redirect } from "next/navigation";

export default function FeeItemsRedirectPage() {
  redirect("/dashboard/finance/fee-structures");
}
