"use client";

import { use } from "react";
import { DiscountSetupWorkspace } from "../discount-setup-workspace";

export default function EditDiscountPage({
  params
}: {
  params: Promise<{ ruleId: string }>;
}) {
  const { ruleId } = use(params);
  return <DiscountSetupWorkspace mode="edit" ruleId={ruleId} />;
}
