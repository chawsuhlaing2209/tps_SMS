"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { paymentMethods, type PaymentMethod } from "@sms/shared";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useApiMutation, useApiQuery } from "../../../../lib/api";
import { Icon } from "../../../../lib/material-icon";
import { toastError, toastSuccess } from "../../../../lib/toast";
import { useTenantFormats } from "../../../../lib/use-tenant-formats";
import { TextInput } from "../../../../../components/shared/form-input";
import { PdsSelectField } from "../../../../../components/pds";
import { EmptyState } from "../../../../../components/shared/empty-state";
import { type PaymentReceiptPayload } from "../../receipt-document";

export type RosterRow = {
  studentId: string;
  studentFullName: string;
  admissionNumber: string;
  gradeId: string;
  gradeName: string;
  classroomName: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  billed: number;
  paid: number;
  balance: number;
  pendingVerification: number;
  recordableBalance: number;
  status: "paid" | "partial" | "due" | "overdue";
  primaryInvoiceId: string | null;
};

export type InvoicePaymentContext = {
  invoiceNumber: string;
  studentFullName: string;
  balanceDue: number;
  billed: number;
  paid: number;
  pendingVerification?: number;
  recordableBalance?: number;
};

type CollectResult = { payment: { id: string; invoiceId: string }; receipt: PaymentReceiptPayload };

type RecordPaymentResult = {
  payment: { id: string };
  receipt: PaymentReceiptPayload;
};

const METHOD_ICONS: Partial<Record<PaymentMethod, string>> = {
  kbzpay: "qr_code_2",
  wavepay: "account_balance_wallet",
  bank_transfer: "account_balance",
  cash: "payments",
  aya_pay: "account_balance_wallet",
  cb_pay: "account_balance_wallet",
  other: "credit_card"
};

const EMPTY_ROSTER: RosterRow[] = [];

type RecordPaymentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCollected: () => void;
} & (
  | {
      variant: "roster";
      initialStudentId: string | null;
      academicYearId: string;
      gradeId?: string;
    }
  | {
      variant: "invoice";
      invoiceId: string;
      context: InvoicePaymentContext;
    }
);

export function RecordPaymentModal(props: RecordPaymentModalProps) {
  const { open, onOpenChange, onCollected } = props;
  const t = useTranslations("finance.feesBilling");
  const tFinance = useTranslations("finance");
  const tPay = useTranslations("enrollments.paymentMethods");
  const { formatMoney } = useTenantFormats();

  const owingQuery = useMemo(() => {
    if (props.variant !== "roster" || !props.academicYearId) return null;
    const params = new URLSearchParams({
      academicYearId: props.academicYearId,
      owingOnly: "true",
      limit: "500"
    });
    if (props.gradeId) params.set("gradeId", props.gradeId);
    return params.toString();
  }, [props]);

  const owingRoster = useApiQuery<{ rows: RosterRow[] }>(
    (tenant) =>
      open && props.variant === "roster" && owingQuery
        ? `/tenants/${tenant}/finance/billing/roster?${owingQuery}`
        : null
  );

  const owingRows = useMemo(
    () =>
      props.variant === "roster"
        ? (owingRoster.data?.rows ?? EMPTY_ROSTER)
        : EMPTY_ROSTER,
    [props.variant, owingRoster.data?.rows]
  );

  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");

  const collectableRows = useMemo(
    () =>
      props.variant === "roster"
        ? owingRows.filter((row) => (row.recordableBalance ?? row.balance) > 0)
        : owingRows,
    [owingRows, props.variant]
  );

  const selectedRosterRow = useMemo(() => {
    if (props.variant !== "roster") return null;
    return collectableRows.find((row) => row.studentId === studentId) ?? collectableRows[0] ?? null;
  }, [collectableRows, props.variant, studentId]);

  const maxAmount =
    props.variant === "invoice"
      ? (props.context.recordableBalance ?? props.context.balanceDue)
      : (selectedRosterRow?.recordableBalance ?? selectedRosterRow?.balance ?? 0);

  const billed =
    props.variant === "invoice" ? props.context.billed : (selectedRosterRow?.billed ?? 0);

  const paid = props.variant === "invoice" ? props.context.paid : (selectedRosterRow?.paid ?? 0);

  const balance =
    props.variant === "invoice" ? props.context.balanceDue : (selectedRosterRow?.balance ?? 0);

  const pendingVerification =
    props.variant === "invoice"
      ? (props.context.pendingVerification ?? 0)
      : (selectedRosterRow?.pendingVerification ?? 0);

  useEffect(() => {
    if (!open) return;
    setReference("");
    setMethod("cash");
  }, [open]);

  const initialStudentId = props.variant === "roster" ? props.initialStudentId : null;

  useEffect(() => {
    if (!open || props.variant !== "roster") return;
    const target =
      initialStudentId && collectableRows.some((row) => row.studentId === initialStudentId)
        ? initialStudentId
        : (collectableRows[0]?.studentId ?? "");
    setStudentId(target);
  }, [open, props.variant, initialStudentId, collectableRows]);

  useEffect(() => {
    if (!open) return;
    if (maxAmount > 0) setAmount(String(Math.round(maxAmount)));
  }, [open, maxAmount]);

  const collect = useApiMutation<
    {
      studentId: string;
      academicYearId: string;
      amount: number;
      method: string;
      referenceNumber?: string;
    },
    CollectResult
  >(
    (body, tenant) => ({
      path: `/tenants/${tenant}/finance/billing/collect`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `/tenants/${tenant}/finance/billing/roster`,
        `/tenants/${tenant}/finance/invoices`,
        `/tenants/${tenant}/finance/invoices/metrics`,
        `/tenants/${tenant}/finance/payments`
      ],
      showSuccessToast: false
    }
  );

  const payInvoice = useApiMutation<
    { amount: number; method: string; referenceNumber?: string },
    RecordPaymentResult
  >(
    (body, tenant) => {
      const invoiceId = props.variant === "invoice" ? props.invoiceId : "";
      return {
        path: `/tenants/${tenant}/finance/invoices/${invoiceId}/payments`,
        init: { method: "POST", body: JSON.stringify(body) }
      };
    },
    {
      invalidatePaths: (_b, tenant) => {
        if (props.variant !== "invoice") return [];
        return [
          `/tenants/${tenant}/finance/invoices/${props.invoiceId}`,
          `/tenants/${tenant}/finance/invoices/${props.invoiceId}/activity`,
          `/tenants/${tenant}/finance/invoices`,
          `/tenants/${tenant}/finance/payments`,
          `/tenants/${tenant}/finance/billing/roster`
        ];
      },
      showSuccessToast: false
    }
  );

  const isPending = collect.isPending || payInvoice.isPending;
  const amountNumber = Number(amount);
  const needsReference = method !== "cash";
  const balanceAfter = Math.max(0, balance - (amountNumber || 0));

  const canSubmit =
    maxAmount > 0 &&
    amountNumber > 0 &&
    amountNumber <= maxAmount &&
    (!needsReference || reference.trim().length > 0) &&
    !isPending &&
    (props.variant === "invoice" || Boolean(selectedRosterRow));

  const handleSubmit = async () => {
    if (amountNumber > maxAmount) {
      toastError(new Error(t("amountExceeds")));
      return;
    }

    try {
      if (props.variant === "invoice") {
        await payInvoice.mutateAsync({
          amount: amountNumber,
          method,
          ...(needsReference ? { referenceNumber: reference.trim() } : {})
        });
      } else if (selectedRosterRow) {
        await collect.mutateAsync({
          studentId: selectedRosterRow.studentId,
          academicYearId: props.academicYearId,
          amount: amountNumber,
          method,
          ...(needsReference ? { referenceNumber: reference.trim() } : {})
        });
      }

      toastSuccess(t("receiptTitle"));
      onCollected();
      onOpenChange(false);
    } catch {
      // toast handled by mutation
    }
  };

  const showEmpty =
    props.variant === "roster" && !selectedRosterRow;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="pay-modal__overlay" />
        <DialogPrimitive.Content className="pay-modal" aria-describedby={undefined}>
          <DialogPrimitive.Title className="sr-only">{t("modalTitle")}</DialogPrimitive.Title>

          <header className="pay-modal__head">
            <DialogPrimitive.Title className="pds-type-title-xs-bold pay-modal__title">
              {tFinance("recordPayment")}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="pay-modal__close" aria-label={t("cancel")}>
              <Icon name="close" size={18} />
            </DialogPrimitive.Close>
          </header>

          {showEmpty ? (
            <EmptyState compact embedded icon="group" title={t("noOwingStudents")} />
          ) : (
            <div className="pay-modal__body">
              {props.variant === "invoice" ? (
                <p className="pds-type-body-s-semibold pay-modal__invoice-ref muted">{props.context.invoiceNumber}</p>
              ) : null}

              {props.variant === "roster" && selectedRosterRow ? (
                <div className="pay-field">
                  <span className="pds-type-body-s-semibold pay-field__label">{t("selectStudent")}</span>
                  <PdsSelectField
                    variant="form"
                    value={selectedRosterRow.studentId}
                    onValueChange={(value) => setStudentId(typeof value === "string" ? value : "")}
                    options={collectableRows.map((row) => ({
                      value: row.studentId,
                      label: t("studentOption", {
                        name: row.studentFullName,
                        room: row.classroomName ?? row.gradeName,
                        due: formatMoney(row.recordableBalance)
                      })
                    }))}
                  />
                </div>
              ) : null}

              <div className="pay-tiles">
                <div className="pay-tile">
                  <span className="pds-type-caption-s pay-tile__label">{t("billed")}</span>
                  <strong className="pds-type-body-m-medium pay-tile__value">{formatMoney(billed)}</strong>
                </div>
                <div className="pay-tile">
                  <span className="pds-type-caption-s pay-tile__label">{t("paid")}</span>
                  <strong className="pds-type-body-m-medium pay-tile__value">{formatMoney(paid)}</strong>
                </div>
                <div className="pay-tile pay-tile--balance">
                  <span className="pds-type-caption-s pay-tile__label">{t("balance")}</span>
                  <strong className="pds-type-body-m-medium pay-tile__value">{formatMoney(balance)}</strong>
                </div>
              </div>

              {pendingVerification > 0 && maxAmount > 0 ? (
                <p className="pds-type-body-s-regular muted">
                  {tFinance("recordPaymentPartialPending", {
                    pending: formatMoney(pendingVerification),
                    recordable: formatMoney(maxAmount)
                  })}
                </p>
              ) : null}

              <div className="pay-field">
                <label htmlFor="pay-modal-amount" className="pds-type-body-s-semibold pay-field__label">
                  {t("amountReceived")}
                </label>
                <TextInput
                  unwrapped
                  id="pay-modal-amount"
                  className="pay-amount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={maxAmount}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>

              <div className="pay-field">
                <span className="pds-type-body-s-semibold pay-field__label">{t("paymentMethod")}</span>
                <div className="pay-methods">
                  {paymentMethods.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={method === option ? "pay-method pay-method--active" : "pay-method"}
                      onClick={() => setMethod(option)}
                    >
                      <Icon name={METHOD_ICONS[option] ?? "payments"} size={18} />
                      {tPay(option)}
                    </button>
                  ))}
                </div>
              </div>

              {needsReference ? (
                <div className="pay-field">
                  <label htmlFor="pay-modal-reference" className="pds-type-body-s-semibold pay-field__label">
                    {t("receiptReference")}
                  </label>
                  <TextInput
                    unwrapped
                    id="pay-modal-reference"
                    className="pay-input"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                  />
                </div>
              ) : null}

              <div className="pay-balance-after">
                <div>
                  <span className="pds-type-body-s-semibold pay-balance-after__label">{t("balanceAfter")}</span>
                  <span className="pds-type-body-s-regular pay-balance-after__sub">
                    {props.variant === "invoice"
                      ? props.context.studentFullName
                      : selectedRosterRow?.studentFullName}
                  </span>
                </div>
                <strong className="pay-balance-after__value">{formatMoney(balanceAfter)}</strong>
              </div>
            </div>
          )}

          <footer className="pay-modal__foot">
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </button>
            <button
              type="button"
              className="pds-type-body-m-bold btn-primary"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              <Icon name="task_alt" size={18} />
              {isPending ? "…" : tFinance("recordPayment")}
            </button>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
