"use client";

import { useTranslations } from "next-intl";
import { FormTextarea } from "../../../../components/shared/form-input";
import { TrailLink } from "../../../../components/shared/trail-link";
import { useMemo, useState } from "react";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { DirectoryMemberCell } from "../../../lib/data-table";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { PadaukTableWrap } from "../../../lib/padauk-table-wrap";
import { hasAnyPermission } from "../../../lib/permissions";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { getSession } from "../../../lib/session";
import { useTenantFormats } from "../../../lib/use-tenant-formats";
import { Badge, type BadgeTone } from "../../../../components/shared/badge";
import { FinanceTableShell } from "../finance-table-shell";

type StudentDiscountRow = {
  id: string;
  studentId: string;
  studentName: string;
  discountRuleId: string;
  ruleName: string;
  discountType: string;
  reason: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
};

type StatusFilter = "" | "submitted" | "approved" | "rejected" | "draft" | "reviewed";

const STATUS_FILTERS: StatusFilter[] = ["", "submitted", "approved", "rejected"];

const STATUS_TONES: Record<string, BadgeTone> = {
  submitted: "warning",
  draft: "neutral",
  reviewed: "info",
  approved: "success",
  rejected: "danger"
};

const REQUESTS_PATH = (tenant: string, status: StatusFilter) => {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const qs = params.toString();
  return `/tenants/${tenant}/discounts/student-discounts${qs ? `?${qs}` : ""}`;
};

export function DiscountRequestsPanel() {
  const t = useTranslations("discounts");
  const c = useTranslations("common");
  const { formatDate } = useTenantFormats();
  const permissions = getSession()?.permissions;
  const canApprove = hasAnyPermission(permissions, ["discount.approve"]);

  const [status, setStatus] = useState<StatusFilter>("submitted");
  const [approveTarget, setApproveTarget] = useState<StudentDiscountRow | null>(null);
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectTarget, setRejectTarget] = useState<StudentDiscountRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const requests = useApiQuery<StudentDiscountRow[]>((tenant) => REQUESTS_PATH(tenant, status));

  const rows = useMemo(() => {
    const data = requests.data ?? [];
    return [...data].sort((a, b) => {
      const rank = (value: string) =>
        value === "submitted" ? 0 : value === "reviewed" ? 1 : value === "draft" ? 2 : 3;
      const cmp = rank(a.status) - rank(b.status);
      return cmp || a.studentName.localeCompare(b.studentName);
    });
  }, [requests.data]);

  const invalidatePaths = (tenant: string) => [
    `/tenants/${tenant}/discounts/student-discounts`,
    `/tenants/${tenant}/discounts/metrics`
  ];

  const approve = useApiMutation<{ discountId: string; body: { notes?: string } }, unknown>(
    ({ discountId, body }, tenant) => ({
      path: `/tenants/${tenant}/discounts/student-discounts/${discountId}/approve`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_v, tenant) => invalidatePaths(tenant),
      successMessage: t("approvedSuccess")
    }
  );

  const reject = useApiMutation<{ discountId: string; body: { reason: string } }, unknown>(
    ({ discountId, body }, tenant) => ({
      path: `/tenants/${tenant}/discounts/student-discounts/${discountId}/reject`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_v, tenant) => invalidatePaths(tenant),
      successMessage: t("rejectedSuccess")
    }
  );

  const statusLabel = (value: string) => {
    if (value === "submitted") return t("statusLabels.submitted");
    if (value === "approved") return t("statusLabels.approved");
    if (value === "rejected") return t("statusLabels.rejected");
    if (value === "draft") return t("statusLabels.draft");
    if (value === "reviewed") return t("statusLabels.reviewed");
    return value;
  };

  const closeApprove = () => {
    setApproveTarget(null);
    setApproveNotes("");
  };

  const closeReject = () => {
    setRejectTarget(null);
    setRejectReason("");
  };

  const pendingCount = rows.filter((row) =>
    ["submitted", "draft", "reviewed"].includes(row.status)
  ).length;

  return (
    <>
      <p className="pds-type-body-s-regular muted panel-help">{t("requestsHelp")}</p>

      <section className="fees-toolbar">
        <div className="fees-segmented" role="tablist" aria-label={t("filterStatus")}>
          {STATUS_FILTERS.map((value) => (
            <button
              key={value || "all"}
              type="button"
              role="tab"
              aria-selected={status === value}
              className={status === value ? "fees-segment fees-segment--active" : "fees-segment"}
              onClick={() => setStatus(value)}
            >
              {value ? statusLabel(value) : t("allStatuses")}
            </button>
          ))}
        </div>
        {canApprove && status === "submitted" && pendingCount > 0 ? (
          <span className="pds-type-body-s-regular muted">{t("pendingCount", { count: pendingCount })}</span>
        ) : null}
      </section>

      <FinanceTableShell
        loading={requests.isLoading}
        error={requests.isError}
        empty={!rows.length}
        emptyMessage={t("noRequests")}
      >
        <PadaukTableWrap>
          <table className="pds-type-body-m-medium padauk-table padauk-table--pinned-end">
            <thead>
              <tr>
                <th className="pds-type-caption-s">{t("student")}</th>
                <th className="pds-type-caption-s">{t("rule")}</th>
                <th className="pds-type-caption-s">{t("reason")}</th>
                <th className="pds-type-caption-s">{t("effectiveFrom")}</th>
                <th className="pds-type-caption-s">{t("status")}</th>
                {canApprove ? <th className="pds-type-caption-s padauk-table__actions">{t("actions")}</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const canAct = canApprove && ["submitted", "draft", "reviewed"].includes(row.status);
                return (
                  <tr key={row.id}>
                    <td>
                      <DirectoryMemberCell
                        name={row.studentName}
                        subtitle={
                          <TrailLink
                            href={`/dashboard/students/${row.studentId}`}
                            className="padauk-table__link"
                            from={{ label: t("pageTitle"), href: "/dashboard/finance/discounts" }}
                          >
                            {t("viewStudent")}
                          </TrailLink>
                        }
                      />
                    </td>
                    <td>{row.ruleName}</td>
                    <td className="padauk-table__muted">{row.reason}</td>
                    <td className="padauk-table__muted">
                      {formatDate(row.effectiveFrom)}
                      {row.effectiveTo ? ` → ${formatDate(row.effectiveTo)}` : null}
                    </td>
                    <td>
                      <Badge tone={STATUS_TONES[row.status] ?? "neutral"}>
                        {statusLabel(row.status)}
                      </Badge>
                    </td>
                    {canApprove ? (
                      <td className="padauk-table__actions">
                        {canAct ? (
                          <div className="table-row-actions">
                            <button
                              type="button"
                              className="pds-type-body-s-semibold table-row-action table-row-action--primary"
                              disabled={approve.isPending || reject.isPending}
                              onClick={() => {
                                setApproveTarget(row);
                                setApproveNotes("");
                              }}
                            >
                              <Icon name="check_circle" size={16} />
                              {t("approve")}
                            </button>
                            <button
                              type="button"
                              className="pds-type-body-s-semibold table-row-action"
                              disabled={approve.isPending || reject.isPending}
                              onClick={() => {
                                setRejectTarget(row);
                                setRejectReason("");
                              }}
                            >
                              <Icon name="block" size={16} />
                              {t("reject")}
                            </button>
                          </div>
                        ) : (
                          <span className="padauk-table__muted">—</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </PadaukTableWrap>
      </FinanceTableShell>

      {approveTarget ? (
        <RecordFormSheet
          open={Boolean(approveTarget)}
          onOpenChange={(open) => {
            if (!open) closeApprove();
          }}
          title={t("approveTitle")}
          onSubmit={(event) => event.preventDefault()}
          footer={
            <>
              <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={closeApprove}>
                {c("cancel")}
              </button>
              <button
                type="button"
                className="pds-type-body-m-bold btn-primary"
                disabled={approve.isPending}
                onClick={async () => {
                  await approve.mutateAsync({
                    discountId: approveTarget.id,
                    body: approveNotes.trim() ? { notes: approveNotes.trim() } : {}
                  });
                  closeApprove();
                }}
              >
                {approve.isPending ? t("approving") : t("approve")}
              </button>
            </>
          }
        >
          <p className="pds-type-body-s-regular muted">
            {approveTarget.studentName} · {approveTarget.ruleName}
          </p>
          <Field label={t("approveNotes")}>
            <FormTextarea
              rows={3}
              value={approveNotes}
              placeholder={t("approveNotesPlaceholder")}
              onChange={(event) => setApproveNotes(event.target.value)}
            />
          </Field>
        </RecordFormSheet>
      ) : null}

      {rejectTarget ? (
        <RecordFormSheet
          open={Boolean(rejectTarget)}
          onOpenChange={(open) => {
            if (!open) closeReject();
          }}
          title={t("rejectTitle")}
          onSubmit={(event) => event.preventDefault()}
          footer={
            <>
              <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={closeReject}>
                {c("cancel")}
              </button>
              <button
                type="button"
                className="pds-type-body-m-bold btn-primary"
                disabled={reject.isPending || !rejectReason.trim()}
                onClick={async () => {
                  await reject.mutateAsync({
                    discountId: rejectTarget.id,
                    body: { reason: rejectReason.trim() }
                  });
                  closeReject();
                }}
              >
                {reject.isPending ? t("rejecting") : t("reject")}
              </button>
            </>
          }
        >
          <p className="pds-type-body-s-regular muted">
            {rejectTarget.studentName} · {rejectTarget.ruleName}
          </p>
          <Field label={t("rejectReason")}>
            <FormTextarea
              rows={3}
              value={rejectReason}
              placeholder={t("rejectReasonPlaceholder")}
              onChange={(event) => setRejectReason(event.target.value)}
            />
          </Field>
        </RecordFormSheet>
      ) : null}
    </>
  );
}
