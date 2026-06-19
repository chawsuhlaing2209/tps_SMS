"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ModuleShell, SecondarySideNav } from "../../lib/secondary-side-nav";

export default function FinanceLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("finance");

  return (
    <ModuleShell
      nav={
        <SecondarySideNav
          groups={[
            {
              label: t("navReceivables"),
              items: [
                { href: "/dashboard/finance/invoices", label: t("invoices"), icon: "description" },
                { href: "/dashboard/finance/billing", label: t("collection"), icon: "account_balance_wallet" },
                { href: "/dashboard/finance/payments", label: t("payments"), icon: "account_balance" },
                { href: "/dashboard/finance/reports", label: t("reports"), icon: "bar_chart" }
              ]
            },
            {
              label: t("navFinance"),
              items: [
                {
                  href: "/dashboard/finance/fee-structures",
                  label: t("feeStructures"),
                  icon: "sell"
                },
                {
                  href: "/dashboard/finance/payment-plans",
                  label: t("paymentPlans"),
                  icon: "payments"
                },
                { href: "/dashboard/finance/discounts", label: t("discounts"), icon: "percent" }
              ]
            }
          ]}
        />
      }
    >
      {children}
    </ModuleShell>
  );
}
