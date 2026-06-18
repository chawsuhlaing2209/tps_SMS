"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Icon } from "../../../lib/material-icon";
import { buildDiscountPreview, type DiscountPreviewSample } from "./discount-preview";
import type { DiscountRuleFormValues } from "./discount-form";

type Props = {
  form: DiscountRuleFormValues;
  sample: DiscountPreviewSample;
  feeTypesByItemId: Record<string, string>;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

export function DiscountLivePreview({ form, sample, feeTypesByItemId }: Props) {
  const t = useTranslations("discounts");
  const preview = useMemo(
    () => buildDiscountPreview(form, sample, feeTypesByItemId),
    [form, sample, feeTypesByItemId]
  );

  const visibleLines = sample.feeLines.filter((line) => {
    if (!preview.appliesTo.feeTypes.length) {
      return true;
    }
    if (!preview.appliesTo.feeTypes.includes(line.feeType)) {
      return false;
    }
    if (preview.appliesTo.feeItemIds?.length) {
      return preview.appliesTo.feeItemIds.includes(line.feeItemId);
    }
    return true;
  });

  return (
    <aside className="discount-live-preview">
      <div className="discount-live-preview__head">
        <Icon name="visibility" size={18} />
        <span>{t("livePreview")}</span>
      </div>

      <div className="discount-live-preview__rule">
        <span className="discount-live-preview__rule-icon" aria-hidden>
          <Icon name="sell" />
        </span>
        <div>
          <strong>{preview.ruleName}</strong>
          <p className="muted">
            {preview.valueType === "fixed"
              ? t("previewRuleMetaFixed", { amount: formatMoney(Number(form.value || 0)) })
              : t("previewRuleMeta", { value: form.value || "0" })}
          </p>
        </div>
      </div>

      <div className="discount-live-preview__invoice">
        <p className="discount-live-preview__eyebrow">
          {t("sampleInvoice", { grade: sample.gradeName })}
        </p>
        <p className="discount-live-preview__student">{sample.studentName}</p>

        <ul className="discount-live-preview__lines">
          {visibleLines.map((line) => (
            <li key={line.feeItemId}>
              <span>{line.feeItemName ?? line.feeType}</span>
              <span>{formatMoney(line.lineTotal)}</span>
            </li>
          ))}
        </ul>

        <div className="discount-live-preview__subtotal">
          <span>{t("previewSubtotal")}</span>
          <span>{formatMoney(preview.subtotal)}</span>
        </div>

        {preview.amount > 0 ? (
          <div className="discount-live-preview__discount">
            <span>{preview.ruleName}</span>
            <span>-{formatMoney(preview.amount)}</span>
          </div>
        ) : (
          <p className="discount-live-preview__hint muted">{preview.eligibilityReason}</p>
        )}

        <div className="discount-live-preview__net">
          <div>
            <span className="discount-live-preview__net-label">{t("previewNetPayable")}</span>
            <span className="muted">{t("previewAfterDiscount")}</span>
          </div>
          <strong>{formatMoney(preview.net)}</strong>
          {preview.amount > 0 ? (
            <span className="discount-live-preview__save">{t("previewYouSave", { amount: formatMoney(preview.amount) })}</span>
          ) : null}
        </div>
      </div>

      <div className="discount-live-preview__ledger">
        <p className="discount-live-preview__eyebrow">{t("previewLedgerTitle")}</p>
        {preview.amount > 0 ? (
          <>
            <div className="discount-live-preview__ledger-row">
              <span>{t("previewLedgerLine", { name: preview.ruleName })}</span>
              <span>-{formatMoney(preview.amount)}</span>
            </div>
            <p className="muted">{t("previewLedgerNote")}</p>
          </>
        ) : (
          <p className="muted">{preview.eligibilityReason}</p>
        )}
      </div>
    </aside>
  );
}
