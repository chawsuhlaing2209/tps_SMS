import { redirect } from "next/navigation";

export default async function EditDiscountPage({
  params
}: {
  params: Promise<{ ruleId: string }>;
}) {
  const { ruleId } = await params;
  redirect(`/dashboard/finance/discounts?edit=${ruleId}`);
}
