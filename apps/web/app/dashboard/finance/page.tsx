"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FinanceOverviewRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/finance/billing");
  }, [router]);

  return null;
}
