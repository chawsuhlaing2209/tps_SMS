"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const SUBMODULES = [
  { href: "/dashboard/finance/billing", key: "billing" },
  { href: "/dashboard/finance/fee-structures", key: "feeStructures" },
  { href: "/dashboard/finance/payment-plans", key: "paymentPlans" },
  { href: "/dashboard/finance/invoices", key: "invoices" },
  { href: "/dashboard/finance/payments", key: "payments" },
  { href: "/dashboard/finance/discounts", key: "discounts" },
  { href: "/dashboard/finance/reports", key: "reports" }
] as const;

export default function FinanceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("finance");

  return (
    <div className="page-stack">
      <nav className="subnav">
        {SUBMODULES.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? "subnav-link subnav-link--active" : "subnav-link"}
            >
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
      <div>{children}</div>
    </div>
  );
}
