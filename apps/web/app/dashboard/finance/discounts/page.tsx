"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { DataTable } from "../../../lib/data-table";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/icon";
import { hasAnyPermission } from "../../../lib/permissions";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { StudentCombobox } from "../../../lib/student-combobox";
import { getSession } from "../../../lib/session";
import { TablePanelBody, TablePanelHead } from "../../../lib/table-panel";
import { zodResolver } from "../../../lib/zod-resolver";

type DiscountRule = {
  id: string;
  name: string;
  discountType: string;
  valueType: string;
  value: string;
  approvalThreshold: string | null;
  status: string;
  updatedAt?: string;
};

type StudentDiscount = {
  id: string;
  studentId: string;
  studentFullName: string | null;
  discountRuleId: string;
  ruleName: string | null;
  reason: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  updatedAt?: string;
};

type RuleValues = {
  name: string;
  discountType: string;
  valueType: string;
  value: string;
  approvalThreshold: string;
};
type RequestValues = {
  studentId: string;
  discountRuleId: string;
  reason: string;
  effectiveFrom: string;
  effectiveTo: string;
};

const RULES_PATH = (tenant: string) => `/tenants/${tenant}/discounts/rules`;
const STUDENT_DISCOUNTS_PATH = (tenant: string) => `/tenants/${tenant}/discounts/student-discounts`;

export default function DiscountsPage() {
  const t = useTranslations("discounts");
  const a = useTranslations("academics");
  const c = useTranslations("common");
  const requiredMessage = c("required");
  const permissions = getSession()?.permissions;
  const canApprove = hasAnyPermission(permissions, ["discount.approve"]);
  const canRequest = hasAnyPermission(permissions, ["discount.request"]);

  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleMode, setRuleMode] = useState<"create" | "edit">("create");
  const [editingRule, setEditingRule] = useState<DiscountRule | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  const rules = useApiQuery<DiscountRule[]>(RULES_PATH);

  const discountsQuery = useMemo(
    () => (statusFilter ? `?status=${statusFilter}` : ""),
    [statusFilter]
  );
  const studentDiscounts = useApiQuery<StudentDiscount[]>(
    (tn) => `${STUDENT_DISCOUNTS_PATH(tn)}${discountsQuery}`
  );

  const studentName = (row: StudentDiscount) => row.studentFullName ?? row.studentId;

  const invalidateDiscounts = (tenant: string) => [STUDENT_DISCOUNTS_PATH(tenant)];

  const createRule = useApiMutation<Record<string, unknown>>(
    (body, tenant) => ({
      path: RULES_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [RULES_PATH(tenant)] }
  );

  const updateRule = useApiMutation<{ id: string } & Record<string, unknown>>(
    ({ id, ...body }, tenant) => ({
      path: `${RULES_PATH(tenant)}/${id}`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [RULES_PATH(tenant)] }
  );

  const archiveRule = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${RULES_PATH(tenant)}/${id}/archive`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [RULES_PATH(tenant)] }
  );

  const reactivateRule = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${RULES_PATH(tenant)}/${id}/reactivate`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [RULES_PATH(tenant)] }
  );

  const requestDiscount = useApiMutation<Record<string, unknown>>(
    (body, tenant) => ({
      path: STUDENT_DISCOUNTS_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => invalidateDiscounts(tenant) }
  );

  const approve = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${STUDENT_DISCOUNTS_PATH(tenant)}/${id}/approve`,
      init: { method: "POST", body: JSON.stringify({}) }
    }),
    { invalidatePaths: (_b, tenant) => invalidateDiscounts(tenant) }
  );

  const reject = useApiMutation<{ id: string; reason: string }>(
    ({ id, reason }, tenant) => ({
      path: `${STUDENT_DISCOUNTS_PATH(tenant)}/${id}/reject`,
      init: { method: "POST", body: JSON.stringify({ reason }) }
    }),
    { invalidatePaths: (_b, tenant) => invalidateDiscounts(tenant) }
  );

  const ruleSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, requiredMessage),
        discountType: z.string().trim().min(1, requiredMessage),
        valueType: z.string().trim().min(1, requiredMessage),
        value: z.string().trim().min(1, requiredMessage),
        approvalThreshold: z.string()
      }),
    [requiredMessage]
  );

  const requestSchema = useMemo(
    () =>
      z.object({
        studentId: z.string().uuid(requiredMessage),
        discountRuleId: z.string().uuid(requiredMessage),
        reason: z.string().trim().min(1, requiredMessage),
        effectiveFrom: z.string().trim().min(1, requiredMessage),
        effectiveTo: z.string()
      }),
    [requiredMessage]
  );

  const ruleForm = useForm<RuleValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      name: "",
      discountType: "scholarship",
      valueType: "percentage",
      value: "",
      approvalThreshold: ""
    }
  });

  const requestForm = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      studentId: "",
      discountRuleId: "",
      reason: "",
      effectiveFrom: "",
      effectiveTo: ""
    }
  });

  const ruleColumns: ColumnDef<DiscountRule, unknown>[] = [
    { id: "name", header: t("ruleName"), accessorKey: "name" },
    { id: "discountType", header: t("discountType"), accessorKey: "discountType" },
    { id: "valueType", header: t("valueType"), accessorKey: "valueType" },
    { id: "value", header: t("value"), accessorKey: "value" },
    {
      id: "status",
      header: t("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <span className={`badge badge--${row.original.status}`}>{row.original.status}</span>
      )
    },
    {
      id: "ruleActions",
      header: t("actions"),
      enableSorting: false,
      cell: ({ row }) =>
        canApprove ? (
          <div style={{ display: "flex", gap: "8px" }}>
            {row.original.status !== "archived" ? (
              <>
                <button
                  type="button"
                  className="row-action"
                  onClick={() => {
                    setRuleMode("edit");
                    setEditingRule(row.original);
                    ruleForm.reset({
                      name: row.original.name,
                      discountType: row.original.discountType,
                      valueType: row.original.valueType,
                      value: row.original.value,
                      approvalThreshold: row.original.approvalThreshold ?? ""
                    });
                    setRuleOpen(true);
                  }}
                >
                  {a("edit")}
                </button>
                <button
                  type="button"
                  className="row-action"
                  disabled={archiveRule.isPending}
                  onClick={() => void archiveRule.mutateAsync({ id: row.original.id })}
                >
                  {archiveRule.isPending ? a("archiving") : a("archive")}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="row-action"
                disabled={reactivateRule.isPending}
                onClick={() => void reactivateRule.mutateAsync({ id: row.original.id })}
              >
                {reactivateRule.isPending ? a("reactivating") : a("reactivate")}
              </button>
            )}
          </div>
        ) : null
    }
  ];

  const discountColumns: ColumnDef<StudentDiscount, unknown>[] = [
    { id: "student", header: t("student"), accessorFn: (row) => studentName(row) },
    { id: "rule", header: t("rule"), accessorFn: (row) => row.ruleName ?? row.discountRuleId },
    { id: "reason", header: t("reason"), accessorKey: "reason" },
    { id: "from", header: t("effectiveFrom"), accessorKey: "effectiveFrom" },
    {
      id: "status",
      header: t("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <span className={`badge badge--${row.original.status}`}>{row.original.status}</span>
      )
    },
    {
      id: "actions",
      header: t("actions"),
      enableSorting: false,
      cell: ({ row }) =>
        canApprove && !["approved", "rejected"].includes(row.original.status) ? (
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="row-action"
              disabled={approve.isPending}
              onClick={() => void approve.mutateAsync({ id: row.original.id })}
            >
              {approve.isPending ? t("approving") : t("approve")}
            </button>
            <button
              type="button"
              className="row-action"
              disabled={reject.isPending}
              onClick={() => {
                const reason = window.prompt(t("rejectReason"));
                if (reason) void reject.mutateAsync({ id: row.original.id, reason });
              }}
            >
              {reject.isPending ? t("rejecting") : t("reject")}
            </button>
          </div>
        ) : null
    }
  ];

  return (
    <div className="page-stack">
      <section className="panel">
        <TablePanelHead
          title={t("rulesTitle")}
          onRefresh={() => void rules.refetch()}
          onAdd={
            canApprove
              ? () => {
                  setRuleMode("create");
                  setEditingRule(null);
                  ruleForm.reset({
                    name: "",
                    discountType: "scholarship",
                    valueType: "percentage",
                    value: "",
                    approvalThreshold: ""
                  });
                  setRuleOpen(true);
                }
              : undefined
          }
          addLabel={t("addRule")}
        />
        <TablePanelBody
          loading={rules.isLoading}
          error={rules.isError ? c("somethingWrong") : null}
          empty={!rules.data?.length}
        >
          <DataTable columns={ruleColumns} data={rules.data ?? []} />
        </TablePanelBody>
      </section>

      <section className="panel">
        <TablePanelHead
          title={t("requestsTitle")}
          extra={
            <label className="form-inline">
              <span className="muted">{t("filterStatus")}</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">{t("allStatuses")}</option>
                <option value="draft">draft</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>
            </label>
          }
          onRefresh={() => void studentDiscounts.refetch()}
          onAdd={canRequest ? () => setRequestOpen(true) : undefined}
          addLabel={t("request")}
        />
        <TablePanelBody
          loading={studentDiscounts.isLoading}
          error={studentDiscounts.isError ? c("somethingWrong") : null}
          empty={!studentDiscounts.data?.length}
        >
          <DataTable columns={discountColumns} data={studentDiscounts.data ?? []} />
        </TablePanelBody>
      </section>

      <RecordFormSheet
        open={ruleOpen}
        onOpenChange={(open) => {
          setRuleOpen(open);
          if (!open) {
            ruleForm.reset();
            setEditingRule(null);
            setRuleMode("create");
          }
        }}
        title={ruleMode === "edit" ? t("editRuleTitle") : t("addRuleTitle")}
        onSubmit={ruleForm.handleSubmit(async (values) => {
          const payload = {
            name: values.name,
            discountType: values.discountType,
            valueType: values.valueType,
            value: Number(values.value),
            approvalThreshold: values.approvalThreshold
              ? Number(values.approvalThreshold)
              : undefined
          };
          if (ruleMode === "edit" && editingRule) {
            await updateRule.mutateAsync({ id: editingRule.id, ...payload });
          } else {
            await createRule.mutateAsync(payload);
          }
          setRuleOpen(false);
          ruleForm.reset();
          setEditingRule(null);
          setRuleMode("create");
        })}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setRuleOpen(false)}>
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={ruleForm.formState.isSubmitting}
            >
              <Icon name="check" />
              {ruleForm.formState.isSubmitting ? t("creating") : c("save")}
            </button>
          </>
        }
      >
        <Field label={t("ruleName")} error={ruleForm.formState.errors.name?.message}>
          <input type="text" {...ruleForm.register("name")} />
        </Field>
        <Field label={t("discountType")} error={ruleForm.formState.errors.discountType?.message}>
          <select {...ruleForm.register("discountType")}>
            <option value="scholarship">scholarship</option>
            <option value="sibling">sibling</option>
            <option value="staff">staff</option>
            <option value="early_payment">early_payment</option>
          </select>
        </Field>
        <Field label={t("valueType")} error={ruleForm.formState.errors.valueType?.message}>
          <select {...ruleForm.register("valueType")}>
            <option value="percentage">{t("percentage")}</option>
            <option value="fixed">{t("fixed")}</option>
          </select>
        </Field>
        <Field label={t("value")} error={ruleForm.formState.errors.value?.message}>
          <input type="number" step="0.01" min={0} {...ruleForm.register("value")} />
        </Field>
        <Field
          label={t("approvalThreshold")}
          error={ruleForm.formState.errors.approvalThreshold?.message}
        >
          <input type="number" step="0.01" min={0} {...ruleForm.register("approvalThreshold")} />
        </Field>
      </RecordFormSheet>

      <RecordFormSheet
        open={requestOpen}
        onOpenChange={(open) => {
          setRequestOpen(open);
          if (!open) requestForm.reset();
        }}
        title={t("requestTitle")}
        onSubmit={requestForm.handleSubmit(async (values) => {
          await requestDiscount.mutateAsync({
            studentId: values.studentId,
            discountRuleId: values.discountRuleId,
            reason: values.reason,
            effectiveFrom: values.effectiveFrom,
            effectiveTo: values.effectiveTo || undefined
          });
          setRequestOpen(false);
          requestForm.reset();
        })}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setRequestOpen(false)}>
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={requestForm.formState.isSubmitting}
            >
              <Icon name="check" />
              {requestForm.formState.isSubmitting ? t("creating") : c("save")}
            </button>
          </>
        }
      >
        <Field label={t("student")} error={requestForm.formState.errors.studentId?.message}>
          <StudentCombobox
            value={requestForm.watch("studentId")}
            onChange={(studentId) =>
              requestForm.setValue("studentId", studentId, { shouldValidate: true })
            }
          />
        </Field>
        <Field label={t("rule")} error={requestForm.formState.errors.discountRuleId?.message}>
          <select {...requestForm.register("discountRuleId")}>
            <option value="">{t("selectRule")}</option>
            {rules.data?.map((rule) => (
              <option key={rule.id} value={rule.id}>
                {rule.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("reason")} error={requestForm.formState.errors.reason?.message}>
          <textarea rows={2} {...requestForm.register("reason")} />
        </Field>
        <Field label={t("effectiveFrom")} error={requestForm.formState.errors.effectiveFrom?.message}>
          <input type="date" {...requestForm.register("effectiveFrom")} />
        </Field>
        <Field label={t("effectiveTo")} error={requestForm.formState.errors.effectiveTo?.message}>
          <input type="date" {...requestForm.register("effectiveTo")} />
        </Field>
      </RecordFormSheet>
    </div>
  );
}
