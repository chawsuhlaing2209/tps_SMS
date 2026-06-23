import { redirect } from "next/navigation";

export default function NewDiscountPage() {
  redirect("/dashboard/finance/discounts?create=1");
}
