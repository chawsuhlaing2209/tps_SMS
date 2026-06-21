"use client";

import type { PaymentMethod } from "@sms/shared";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

const PAYMENT_METHOD_ORDER: PaymentMethod[] = [
  "cash",
  "bank_transfer",
  "kbzpay",
  "wavepay",
  "aya_pay",
  "cb_pay",
  "other"
];

/** Shared payment method select options — labels from enrollments.paymentMethods. */
export function usePaymentMethodOptions() {
  const t = useTranslations("enrollments.paymentMethods");

  return useMemo(
    () => [
      { value: "cash" as const, label: t("cash") },
      { value: "bank_transfer" as const, label: t("bank_transfer") },
      { value: "kbzpay" as const, label: t("kbzpay") },
      { value: "wavepay" as const, label: t("wavepay") },
      { value: "aya_pay" as const, label: t("aya_pay") },
      { value: "cb_pay" as const, label: t("cb_pay") },
      { value: "other" as const, label: t("other") }
    ],
    [t]
  );
}

export { PAYMENT_METHOD_ORDER };
