"use client";

import "./payment-method-picker.css";
import { paymentMethods, type PaymentMethod } from "@sms/shared";
import { useTranslations } from "next-intl";
import { Icon } from "../../app/lib/material-icon";
import { cn } from "../../lib/utils";
import { FormInput } from "./form-input";

export const PAYMENT_METHOD_ICONS: Partial<Record<PaymentMethod, string>> = {
  kbzpay: "qr_code_2",
  wavepay: "account_balance_wallet",
  bank_transfer: "account_balance",
  cash: "payments",
  aya_pay: "account_balance_wallet",
  cb_pay: "account_balance_wallet",
  other: "credit_card",
};

export function paymentMethodNeedsReference(method: PaymentMethod): boolean {
  return method !== "cash";
}

type PaymentMethodPickerProps = {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  className?: string;
  label?: string;
  reference?: string;
  onReferenceChange?: (value: string) => void;
};

/** Tile grid for payment method — matches finance Collection / record payment modals. */
export function PaymentMethodPicker({
  value,
  onChange,
  className,
  label,
  reference = "",
  onReferenceChange,
}: PaymentMethodPickerProps) {
  const tPay = useTranslations("enrollments.paymentMethods");
  const tFinance = useTranslations("finance.feesBilling");
  const needsReference = paymentMethodNeedsReference(value);

  return (
    <div className={cn("pay-method-picker", className)}>
      <div className="pay-field">
        <span className="pds-type-body-s-semibold pay-field__label">{label ?? tFinance("paymentMethod")}</span>
        <div className="pay-methods">
          {paymentMethods.map((option) => (
            <button
              key={option}
              type="button"
              className={value === option ? "pay-method pay-method--active" : "pay-method"}
              onClick={() => onChange(option)}
            >
              <Icon name={PAYMENT_METHOD_ICONS[option] ?? "payments"} size={18} />
              {tPay(option)}
            </button>
          ))}
        </div>
      </div>

      {onReferenceChange && needsReference ? (
        <label className="pay-field">
          <span className="pds-type-body-s-semibold pay-field__label">{tFinance("receiptReference")}</span>
          <FormInput
            className="pds-type-body-m-medium pay-input"
            value={reference}
            onChange={(event) => onReferenceChange(event.target.value)}
          />
        </label>
      ) : null}
    </div>
  );
}
