"use client";

import { useParams } from "next/navigation";
import { DiscountSetupWorkspace } from "../discount-setup-workspace";

export default function EditDiscountPage() {
  const params = useParams<{ ruleId: string }>();
  return <DiscountSetupWorkspace mode="edit" ruleId={params.ruleId} />;
}
