"use client";

import { TextInput } from "../../../../components/shared/form-input";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { formatMMK } from "../../../lib/money";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useApiMutation } from "../../../lib/api";
import { Icon } from "../../../lib/material-icon";
import { toastError } from "../../../lib/toast";
import {
  PaymentReceiptDocument,
  printPaymentReceipt,
  type PaymentReceiptPayload
} from "../receipt-document";

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
  status: "paid" | "partial" | "due" | "overdue";
  primaryInvoiceId: string | null;
};

type CollectResult = { payment: { id: string; invoiceId: string }; receipt: PaymentReceiptPayload };

const PAYMENT_METHODS = ["kbzpay", "wavepay", "bank_transfer", "cash"] as const;
const METHOD_ICONS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  kbzpay: "qr_code_2",
  wavepay: "account_balance_wallet",
  bank_transfer: "account_balance",
  cash: "payments"
};

function fullNumber(value: number): string {
  return formatMMK(value);
}

export function RecordPaymentModal({
  open,
  onOpenChange,
  rows,
  initialStudentId,
  academicYearId,
  onCollected
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: RosterRow[];
  initialStudentId: string | null;
  academicYearId: string;
  onCollected: () => void;
}) {
  const t = useTranslations("finance.feesBilling");
  const tReceipt = useTranslations("finance.receipt");
  const tPay = useTranslations("enrollments.paymentMethods");

  const owing = useMemo(() => rows.filter((row) => row.balance > 0), [rows]);

  const [studentId, setStudentId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>("kbzpay");
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState<PaymentReceiptPayload | null>(null);

  const selected = useMemo(
    () => owing.find((row) => row.studentId === studentId) ?? owing[0] ?? null,
    [owing, studentId]
  );

  useEffect(() => {
    if (!open) return;
    const target = initialStudentId && owing.some((r) => r.studentId === initialStudentId)
      ? initialStudentId
      : owing[0]?.studentId ?? "";
    setStudentId(target);
    setReceipt(null);
    setReference("");
    setMethod("kbzpay");
  }, [open, initialStudentId, owing]);

  useEffect(() => {
    if (selected) setAmount(String(Math.round(selected.balance)));
  }, [selected]);

  const collect = useApiMutation<
    { studentId: string; academicYearId: string; amount: number; method: string; referenceNumber?: string },
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
        `/tenants/${tenant}/finance/payments`
      ],
      showSuccessToast: false
    }
  );

  const amountNumber = Number(amount);
  const needsReference = method !== "cash";
  const balanceAfter = selected ? Math.max(0, selected.balance - (amountNumber || 0)) : 0;
  const canSubmit =
    Boolean(selected) &&
    amountNumber > 0 &&
    amountNumber <= (selected?.balance ?? 0) &&
    (!needsReference || reference.trim().length > 0) &&
    !collect.isPending;

  const handleSubmit = async () => {
    if (!selected) return;
    if (amountNumber > selected.balance) {
      toastError(new Error(t("amountExceeds")));
      return;
    }
    try {
      const result = await collect.mutateAsync({
        studentId: selected.studentId,
        academicYearId,
        amount: amountNumber,
        method,
        ...(needsReference ? { referenceNumber: reference.trim() } : {})
      });
      setReceipt(result.receipt);
      onCollected();
    } catch {
      // toast handled by mutation
    }
  };

  const printReceipt = () => {
    if (!receipt) return;
    printPaymentReceipt(receipt, {
      header: tReceipt("officialHeader"),
      receiptLabel: tReceipt("numberLabel"),
      student: tReceipt("student"),
      gradeRoom: tReceipt("gradeRoom"),
      guardian: tReceipt("guardian"),
      contact: tReceipt("contact"),
      methodLabel: tReceipt("method"),
      appliedTo: tReceipt("appliedTo"),
      reference: tReceipt("reference"),
      cashier: tReceipt("cashier"),
      amountPaid: tReceipt("amountPaid"),
      remaining: tReceipt("remainingBalance"),
      methodName: tPay(receipt.method)
    });
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="pay-modal__overlay" />
        <DialogPrimitive.Content
          className={receipt ? "pay-modal pay-modal--receipt" : "pay-modal"}
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            {receipt ? tReceipt("title") : t("modalTitle")}
          </DialogPrimitive.Title>
          {receipt ? (
            <PaymentReceiptDocument
              receipt={receipt}
              methodName={tPay(receipt.method)}
              onPrint={printReceipt}
              title={tReceipt("title")}
              subtitle={`${tReceipt("numberLabel")} #${receipt.receiptNumber} · ${receipt.issuedAt.slice(0, 10)}`}
              documentLabel={tReceipt("officialHeader")}
              footer={
                <footer className="pay-modal__foot">
                  <button type="button" className="btn-ghost" onClick={() => onOpenChange(false)}>
                    {t("done")}
                  </button>
                  <button type="button" className="btn-primary" onClick={printReceipt}>
                    <Icon name="print" size={18} />
                    {tReceipt("print")}
                  </button>
                </footer>
              }
            />
          ) : (
            <>
              <header className="pay-modal__head">
                <DialogPrimitive.Title className="pay-modal__title">
                  {t("modalTitle")}
                </DialogPrimitive.Title>
                <DialogPrimitive.Close className="pay-modal__close" aria-label={t("cancel")}>
                  <Icon name="close" size={18} />
                </DialogPrimitive.Close>
              </header>

              {!selected ? (
                <p className="pay-modal__empty">{t("noOwingStudents")}</p>
              ) : (
                <div className="pay-modal__body">
                  <div className="pay-field">
                    <span className="pay-field__label">{t("selectStudent")}</span>
                    <div className="pay-select">
                      <select
                        value={selected.studentId}
                        onChange={(event) => setStudentId(event.target.value)}
                      >
                        {owing.map((row) => (
                          <option key={row.studentId} value={row.studentId}>
                            {t("studentOption", {
                              name: row.studentFullName,
                              room: row.classroomName ?? row.gradeName,
                              due: fullNumber(row.balance)
                            })}
                          </option>
                        ))}
                      </select>
                      <Icon name="unfold_more" size={18} className="pay-select__icon" />
                    </div>
                  </div>

                  <div className="pay-tiles">
                    <div className="pay-tile">
                      <span className="pay-tile__label">{t("billed")}</span>
                      <strong className="pay-tile__value">{fullNumber(selected.billed)}</strong>
                    </div>
                    <div className="pay-tile">
                      <span className="pay-tile__label">{t("paid")}</span>
                      <strong className="pay-tile__value">{fullNumber(selected.paid)}</strong>
                    </div>
                    <div className="pay-tile pay-tile--balance">
                      <span className="pay-tile__label">{t("balance")}</span>
                      <strong className="pay-tile__value">{fullNumber(selected.balance)}</strong>
                    </div>
                  </div>

                  <div className="pay-field">
                    <label htmlFor="pay-modal-amount" className="pay-field__label">
                      {t("amountReceived")}
                    </label>
                    <TextInput
                      unwrapped
                      id="pay-modal-amount"
                      className="pay-amount"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={selected.balance}
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </div>

                  <div className="pay-field">
                    <span className="pay-field__label">{t("paymentMethod")}</span>
                    <div className="pay-methods">
                      {PAYMENT_METHODS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={
                            method === option ? "pay-method pay-method--active" : "pay-method"
                          }
                          onClick={() => setMethod(option)}
                        >
                          <Icon name={METHOD_ICONS[option]} size={18} />
                          {tPay(option)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {needsReference ? (
                    <div className="pay-field">
                      <label htmlFor="pay-modal-reference" className="pay-field__label">
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
                      <span className="pay-balance-after__label">{t("balanceAfter")}</span>
                      <span className="pay-balance-after__sub">
                        {selected.studentFullName} · {selected.classroomName ?? selected.gradeName}
                      </span>
                    </div>
                    <strong className="pay-balance-after__value">{fullNumber(balanceAfter)}</strong>
                  </div>
                </div>
              )}

              <footer className="pay-modal__foot">
                <button type="button" className="btn-ghost" onClick={() => onOpenChange(false)}>
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                >
                  <Icon name="task_alt" size={18} />
                  {collect.isPending ? "…" : t("recordAndSend")}
                </button>
              </footer>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
