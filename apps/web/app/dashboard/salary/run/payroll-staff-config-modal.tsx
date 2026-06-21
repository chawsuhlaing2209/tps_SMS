"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { EntityAvatar } from "../../../../components/pds/subcomponents/entity-avatar";
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalFooterActions,
  ModalFooterStart,
  ModalHeader,
  ModalTitle
} from "../../../../components/pds/composites/modal";
import { PdsSelectField } from "../../../../components/pds";
import { Button } from "../../../../components/ui/button";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { printDocument } from "../../../lib/print-document";
import { usePaymentMethodOptions } from "../../../lib/payment-method-options";
import { getSession } from "../../../lib/session";
import { PayrollNetSummary } from "./payroll-net-summary";
import { PayrollConfigRow, resolvePayrollRowIconTone } from "./payroll-config-row";
import { PayrollSalaryBreakdownView } from "./payroll-salary-breakdown-view";

export type PayrollPackageOption = {
  packageId: string;
  name: string;
  icon: string;
  amount: number;
  enabled: boolean;
};

export type PayrollComponentOption = {
  componentId: string;
  name: string;
  kind: string;
  amount: number;
  enabled: boolean;
};

export type PayrollIncentiveOption = {
  programId: string;
  name: string;
  description: string | null;
  amount: number;
  enabled: boolean;
};

export type PayrollRecordDetail = {
  id: string;
  staffId: string;
  staffFullName: string | null;
  staffEmail: string | null;
  staffRole: string | null;
  department: string | null;
  salaryMonth: string;
  baseSalary: number;
  allowances: number;
  bonus: number;
  deductions: number;
  grossAmount: number;
  netPay: number;
  status: string;
  readOnly: boolean;
  availablePackages: PayrollPackageOption[];
  availableComponents: PayrollComponentOption[];
  availableIncentives: PayrollIncentiveOption[];
};

type Props = {
  recordId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

const recordPath = (tenant: string, recordId: string) =>
  `/tenants/${tenant}/payroll-runs/records/${recordId}`;

function formatMoney(value: number) {
  return Math.round(value).toLocaleString();
}

function personInitials(name: string | null | undefined) {
  if (!name?.trim()) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

async function downloadPayslip(recordId: string) {
  const session = getSession();
  const tenantId = session?.tenantId;
  if (!tenantId) {
    throw new Error("No tenant session");
  }

  const headers = new Headers();
  if (session?.userId) {
    headers.set("x-user-id", session.userId);
  }

  const response = await fetch(
    `/api/tenants/${tenantId}/payroll-runs/records/${recordId}/payslip`,
    { credentials: "include", headers }
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Download failed (${response.status})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `payslip-${recordId}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PayrollStaffConfigModal({ recordId, open, onOpenChange, onSaved }: Props) {
  const t = useTranslations("salary");
  const c = useTranslations("common");
  const paymentMethodOptions = usePaymentMethodOptions();

  const [packages, setPackages] = useState<PayrollPackageOption[]>([]);
  const [components, setComponents] = useState<PayrollComponentOption[]>([]);
  const [incentives, setIncentives] = useState<PayrollIncentiveOption[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const record = useApiQuery<PayrollRecordDetail>(
    (tenant) => (open && recordId ? recordPath(tenant, recordId) : null),
    { staleTime: 0 }
  );

  const updateRecord = useApiMutation<{
    packageSelections: Array<{ packageId: string; enabled: boolean }>;
    componentSelections: Array<{ componentId: string; enabled: boolean; amount?: number }>;
    incentiveSelections: Array<{ programId: string; enabled: boolean; amount?: number }>;
  }>(
    (body, tenant) => ({
      path: recordPath(tenant, recordId!),
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) =>
        recordId ? [recordPath(tenant, recordId), `/tenants/${tenant}/payroll-runs`] : []
    }
  );

  const approve = useApiMutation<Record<string, never>>(
    (_body, tenant) => ({
      path: `${recordPath(tenant, recordId!)}/approve`,
      init: { method: "POST", body: JSON.stringify({}) }
    }),
    {
      invalidatePaths: (_b, tenant) =>
        recordId ? [recordPath(tenant, recordId), `/tenants/${tenant}/payroll-runs`] : []
    }
  );

  const markPaid = useApiMutation<{ paymentMethod: string }>(
    (body, tenant) => ({
      path: `${recordPath(tenant, recordId!)}/mark-paid`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) =>
        recordId ? [recordPath(tenant, recordId), `/tenants/${tenant}/payroll-runs`] : []
    }
  );

  function handleDownloadPayslip() {
    if (!recordId) return;
    setDownloadError(null);
    setDownloading(true);
    void downloadPayslip(recordId)
      .catch((error: unknown) => {
        setDownloadError(error instanceof Error ? error.message : t("downloadPayslipFailed"));
      })
      .finally(() => setDownloading(false));
  }

  useEffect(() => {
    if (!open) {
      setDownloadError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!record.data) return;
    const data = record.data;
    setPackages(data.availablePackages.map((item) => ({ ...item })));
    setComponents(data.availableComponents.map((item) => ({ ...item })));
    setIncentives(data.availableIncentives.map((item) => ({ ...item })));
  }, [record.data]);

  const data = record.data;
  const readOnly = data?.readOnly ?? false;
  const isPaid = data?.status === "paid";
  const isApproved = data?.status === "approved";
  const isPayslipView = isPaid || isApproved;
  const canEdit = data?.status === "draft" && !readOnly;
  const canApprove = data?.status === "draft" && !readOnly;
  const canMarkPaid = isApproved;

  const packageSummary = useMemo(() => {
    const active = packages.filter((item) => item.enabled);
    const total = active.reduce((sum, item) => sum + item.amount, 0);
    return { count: active.length, total };
  }, [packages]);

  const componentSummary = useMemo(() => {
    const active = components.filter((item) => item.enabled && item.kind !== "deduction");
    const total = active.reduce((sum, item) => sum + item.amount, 0);
    return { count: active.length, total };
  }, [components]);

  const incentiveSummary = useMemo(() => {
    const active = incentives.filter((item) => item.enabled);
    const total = active.reduce((sum, item) => sum + item.amount, 0);
    return { count: active.length, total };
  }, [incentives]);

  const deductionSummary = useMemo(() => {
    const active = components.filter((item) => item.enabled && item.kind === "deduction");
    const total = active.reduce((sum, item) => sum + item.amount, 0);
    return { count: active.length, total };
  }, [components]);

  const compensationBase = data?.baseSalary ?? 0;

  const netPreview = useMemo(() => {
    const allowanceTotal = packageSummary.total + componentSummary.total;
    const deductionTotal = deductionSummary.total;
    const bonusTotal = incentiveSummary.total;
    return compensationBase + allowanceTotal + bonusTotal - deductionTotal;
  }, [
    compensationBase,
    packageSummary.total,
    componentSummary.total,
    deductionSummary.total,
    incentiveSummary.total
  ]);

  function handleSave() {
    if (!recordId || !canEdit) return;
    void updateRecord
      .mutateAsync({
        packageSelections: packages.map((item) => ({
          packageId: item.packageId,
          enabled: item.enabled
        })),
        componentSelections: components.map((item) => ({
          componentId: item.componentId,
          enabled: item.enabled,
          amount: item.amount
        })),
        incentiveSelections: incentives.map((item) => ({
          programId: item.programId,
          enabled: item.enabled,
          amount: item.amount
        }))
      })
      .then(() => {
        onSaved?.();
        void record.refetch();
      });
  }

  const staffMeta = [data?.staffRole, data?.department].filter(Boolean).join(" · ");

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
      }}
    >
      <ModalContent
        className={[
          "payroll-staff-config-modal",
          isPayslipView ? "payroll-staff-config-modal--breakdown" : ""
        ]
          .filter(Boolean)
          .join(" ")}
        aria-describedby={undefined}
      >
        <ModalHeader>
          <ModalTitle>{isPayslipView ? t("breakdownModalTitle") : t("configModalTitle")}</ModalTitle>
          <ModalCloseButton />
        </ModalHeader>

        <ModalBody>
          {record.isLoading ? (
            <p className="pds-type-body-s-regular muted">{c("loading")}</p>
          ) : record.isError || !data ? (
            <p className="pds-type-body-m-medium error-text">{t("notFound")}</p>
          ) : isPayslipView ? (
            <>
              {downloadError ? (
                <p className="pds-type-body-s-regular error-text">{downloadError}</p>
              ) : null}
              <PayrollSalaryBreakdownView
                staffId={data.staffId}
                staffFullName={data.staffFullName}
                staffRole={data.staffRole}
                department={data.department}
                salaryMonth={data.salaryMonth}
                baseSalary={data.baseSalary}
                packages={data.availablePackages}
                components={data.availableComponents}
                incentives={data.availableIncentives}
                allowancesTotal={data.allowances}
                bonusesTotal={data.bonus}
                deductionsTotal={data.deductions}
                grossPay={data.grossAmount}
                netPay={data.netPay}
                recordStatus={isPaid ? "paid" : "approved"}
              />
              {canMarkPaid ? (
                <div className="payroll-staff-config-modal__field payroll-staff-config-modal__field--footer-gap">
                  <label
                    className="pds-type-body-s-semibold payroll-staff-config-modal__label"
                    htmlFor="payroll-payment-method"
                  >
                    {t("paymentMethod")}
                  </label>
                  <PdsSelectField
                    variant="form"
                    value={paymentMethod}
                    onValueChange={(value) =>
                      setPaymentMethod(typeof value === "string" ? value : "bank_transfer")
                    }
                    options={paymentMethodOptions}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <div className="payroll-staff-config-modal__stack">
              <div className="payroll-staff-config-modal__staff">
                <EntityAvatar
                  initials={personInitials(data.staffFullName)}
                  nameForColor={data.staffFullName ?? data.staffId}
                />
                <div className="payroll-staff-config-modal__staff-meta">
                  <p className="pds-type-body-l-medium">{data.staffFullName ?? data.staffId}</p>
                  {staffMeta ? (
                    <p className="pds-type-body-s-regular muted">{staffMeta}</p>
                  ) : null}
                </div>
              </div>

              <div className="payroll-staff-config-modal__field">
                <span className="pds-type-body-s-semibold payroll-staff-config-modal__label">
                  {t("baseSalaryMonthly")}
                </span>
                <div className="payroll-staff-config-modal__base-display">
                  <span className="pds-type-title-xs-bold">{formatMoney(compensationBase)}</span>
                  <span className="pds-type-body-s-semibold payroll-staff-config-modal__suffix">MMK</span>
                </div>
                <p className="pds-type-body-s-regular muted">{t("baseSalaryFromProfile")}</p>
              </div>

              {components.length > 0 ? (
                <section className="payroll-staff-config-modal__section">
                  <div className="payroll-staff-config-modal__section-head">
                    <h3 className="pds-type-title-xxs-extrabold">{t("payComponentsSection")}</h3>
                    <p className="pds-type-body-s-regular muted">
                      {t("sectionActiveSummary", {
                        count: componentSummary.count,
                        total: formatMoney(componentSummary.total)
                      })}
                    </p>
                  </div>
                  <ul className="payroll-staff-config-modal__rows">
                    {components.map((item) => (
                      <PayrollConfigRow
                        key={item.componentId}
                        icon={item.kind === "deduction" ? "remove_circle_outline" : "payments"}
                        iconTone={resolvePayrollRowIconTone(
                          item.kind === "deduction" ? "remove_circle_outline" : "payments",
                          item.kind
                        )}
                        label={item.name}
                        amount={item.amount}
                        enabled={item.enabled}
                        readOnly={!canEdit}
                        onToggle={(checked) => {
                          setComponents((prev) =>
                            prev.map((row) =>
                              row.componentId === item.componentId
                                ? { ...row, enabled: checked }
                                : row
                            )
                          );
                        }}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}

              {packages.length > 0 ? (
                <section className="payroll-staff-config-modal__section">
                  <div className="payroll-staff-config-modal__section-head">
                    <h3 className="pds-type-title-xxs-extrabold">{t("allowancePackagesSection")}</h3>
                    <p className="pds-type-body-s-regular muted">
                      {t("sectionActiveSummary", {
                        count: packageSummary.count,
                        total: formatMoney(packageSummary.total)
                      })}
                    </p>
                  </div>
                  <ul className="payroll-staff-config-modal__rows">
                    {packages.map((item) => (
                      <PayrollConfigRow
                        key={item.packageId}
                        icon={item.icon}
                        iconTone={resolvePayrollRowIconTone(item.icon)}
                        label={item.name}
                        amount={item.amount}
                        enabled={item.enabled}
                        readOnly={!canEdit}
                        onToggle={(checked) => {
                          setPackages((prev) =>
                            prev.map((row) =>
                              row.packageId === item.packageId ? { ...row, enabled: checked } : row
                            )
                          );
                        }}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}

              {incentives.length > 0 ? (
                <section className="payroll-staff-config-modal__section">
                  <div className="payroll-staff-config-modal__section-head">
                    <h3 className="pds-type-title-xxs-extrabold">{t("bonusIncentivesSection")}</h3>
                    <p className="pds-type-body-s-regular muted">
                      {t("sectionActiveSummary", {
                        count: incentiveSummary.count,
                        total: formatMoney(incentiveSummary.total)
                      })}
                    </p>
                  </div>
                  <ul className="payroll-staff-config-modal__rows">
                    {incentives.map((item) => (
                      <PayrollConfigRow
                        key={item.programId}
                        icon="emoji_events"
                        iconTone="amber"
                        label={item.name}
                        description={item.description}
                        amount={item.amount}
                        enabled={item.enabled}
                        readOnly={!canEdit}
                        onToggle={(checked) => {
                          setIncentives((prev) =>
                            prev.map((row) =>
                              row.programId === item.programId ? { ...row, enabled: checked } : row
                            )
                          );
                        }}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}

              <PayrollNetSummary
                base={compensationBase}
                allowances={packageSummary.total + componentSummary.total}
                bonuses={incentiveSummary.total}
                deductions={deductionSummary.total}
                netPay={netPreview}
              />
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          {isPaid ? (
            <>
              <ModalFooterStart>
                <Button
                  type="button"
                  buttonType="outlined"
                  buttonColor="secondary"
                  prefixIcon="print"
                  onClick={() =>
                    printDocument("#payroll-salary-breakdown-print", {
                      title: t("breakdownModalTitle"),
                      width: "narrow"
                    })
                  }
                >
                  {t("breakdownPrint")}
                </Button>
              </ModalFooterStart>
              <ModalFooterActions>
                <Button
                  type="button"
                  buttonType="outlined"
                  buttonColor="secondary"
                  prefixIcon="download"
                  disabled={downloading}
                  onClick={handleDownloadPayslip}
                >
                  {downloading ? c("loading") : t("breakdownDownload")}
                </Button>
                <Button
                  type="button"
                  buttonType="outlined"
                  buttonColor="secondary"
                  onClick={() => onOpenChange(false)}
                >
                  {c("close")}
                </Button>
              </ModalFooterActions>
            </>
          ) : isApproved ? (
            <ModalFooterActions>
              <Button type="button" buttonType="outlined" buttonColor="secondary" onClick={() => onOpenChange(false)}>
                {c("close")}
              </Button>
              <Button
                type="button"
                buttonType="filled"
                buttonColor="primary"
                prefixIcon="payments"
                disabled={markPaid.isPending}
                onClick={() =>
                  void markPaid.mutateAsync({ paymentMethod }).then(() => {
                    onSaved?.();
                    void record.refetch();
                  })
                }
              >
                {markPaid.isPending ? c("loading") : t("markPaid")}
              </Button>
            </ModalFooterActions>
          ) : (
            <ModalFooterActions>
              <Button type="button" buttonType="outlined" buttonColor="secondary" onClick={() => onOpenChange(false)}>
                {c("cancel")}
              </Button>
              {canEdit ? (
                <Button
                  type="button"
                  buttonType="filled"
                  buttonColor="primary"
                  prefixIcon="save"
                  disabled={updateRecord.isPending || record.isLoading}
                  onClick={handleSave}
                >
                  {updateRecord.isPending ? c("loading") : t("saveCompensation")}
                </Button>
              ) : null}
              {canApprove ? (
                <Button
                  type="button"
                  buttonType="outlined"
                  buttonColor="secondary"
                  prefixIcon="check_circle"
                  disabled={approve.isPending}
                  onClick={() =>
                    void approve.mutateAsync({}).then(() => {
                      onSaved?.();
                      void record.refetch();
                    })
                  }
                >
                  {approve.isPending ? c("loading") : t("approveRecord")}
                </Button>
              ) : null}
            </ModalFooterActions>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
