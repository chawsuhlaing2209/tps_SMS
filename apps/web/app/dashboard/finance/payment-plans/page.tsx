"use client";
import { FormInput } from "../../../../components/shared/form-input";

import { useTranslations } from "next-intl";
import { cn } from "../../../../lib/utils";
import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, useApiMutation, useApiQuery } from "../../../lib/api";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { zodResolver } from "../../../lib/zod-resolver";
import { PdsSelectField } from "../../../../components/pds";
import { ConfirmDialog } from "../../../../components/shared/confirm-dialog";
import { PageHeader } from "../../page-header-context";
import { hasAnyPermission } from "../../../lib/permissions";
import { getSession } from "../../../lib/session";
import { EmptyState } from "../../../../components/shared/empty-state";
import styles from "./payment-plans.module.css";

type Installment = {
  id: string;
  label: string;
  dueDate: string;
  installmentCount: number | null;
  sortOrder: number;
};

type PaymentPlan = {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  status: string;
  sortOrder: number;
  installments: Installment[];
};

type ScheduleFormValues = {
  installments: Array<{
    label: string;
    dueDate: string;
    installmentCount?: string;
  }>;
};

type CreateFormValues = {
  name: string;
  description?: string;
  frequency: (typeof FREQUENCIES)[number];
};

const PLANS_PATH = (tenant: string) => `/tenants/${tenant}/finance/payment-plans`;
const FREQUENCIES = ["annual", "term", "monthly"] as const;

function planIcon(frequency: string): string {
  switch (frequency) {
    case "term":
      return "view_week";
    case "monthly":
      return "calendar_month";
    default:
      return "payments";
  }
}

export default function PaymentPlansPage() {
  const t = useTranslations("finance");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["finance.manage"]);

  const plans = useApiQuery<PaymentPlan[]>(PLANS_PATH);
  const [schedulePlan, setSchedulePlan] = useState<PaymentPlan | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState<PaymentPlan | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const toggleStatus = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${PLANS_PATH(tenant)}/${id}/toggle-status`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [PLANS_PATH(tenant)] }
  );

  const updateInstallments = useApiMutation<{ id: string; installments: unknown[] }>(
    ({ id, installments }, tenant) => ({
      path: `${PLANS_PATH(tenant)}/${id}/installments`,
      init: { method: "PUT", body: JSON.stringify({ installments }) }
    }),
    { invalidatePaths: (_b, tenant) => [PLANS_PATH(tenant)] }
  );

  const createPlan = useApiMutation<CreateFormValues & { installments: unknown[] }>(
    (body, tenant) => ({
      path: PLANS_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [PLANS_PATH(tenant)] }
  );

  const deletePlan = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${PLANS_PATH(tenant)}/${id}`,
      init: { method: "DELETE" }
    }),
    { invalidatePaths: (_b, tenant) => [PLANS_PATH(tenant)] }
  );

  const scheduleSchema = useMemo(
    () =>
      z.object({
        installments: z
          .array(
            z.object({
              label: z.string().trim().min(1, c("required")),
              dueDate: z.string().trim().min(1, c("required")),
              installmentCount: z.string().optional()
            })
          )
          .min(1)
      }),
    [c]
  );

  const createSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, c("required")),
        description: z.string().optional(),
        frequency: z.enum(FREQUENCIES)
      }),
    [c]
  );

  const scheduleForm = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { installments: [{ label: "", dueDate: "", installmentCount: "" }] }
  });

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", description: "", frequency: "annual" }
  });

  const installmentFields = useFieldArray({
    control: scheduleForm.control,
    name: "installments"
  });

  const sortedPlans = useMemo(
    () => [...(plans.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [plans.data]
  );

  const openSchedule = (plan: PaymentPlan) => {
    scheduleForm.reset({
      installments: plan.installments.length
        ? plan.installments.map((item) => ({
            label: item.label,
            dueDate: item.dueDate,
            installmentCount: item.installmentCount ? String(item.installmentCount) : ""
          }))
        : [{ label: "", dueDate: "", installmentCount: "" }]
    });
    setFormError(null);
    setSchedulePlan(plan);
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title={t("paymentPlansTitle")}
        description={t("paymentPlansHelp")}
        breadcrumbs={[
          { label: nav("group_business") },
          { label: nav("finance"), href: "/dashboard/finance/invoices" },
          { label: t("paymentPlansTitle") }
        ]}
      />

      <div className={styles.intro}>
        <p className={cn("pds-type-body-m-medium", styles.introText)}>{t("paymentPlansIntro")}</p>
        {canManage ? (
          <button
            type="button"
            className="pds-type-body-m-bold btn-primary"
            onClick={() => {
              createForm.reset({ name: "", description: "", frequency: "annual" });
              setFormError(null);
              setCreateOpen(true);
            }}
          >
            <Icon name="add" />
            {t("createPaymentPlan")}
          </button>
        ) : null}
      </div>

      {plans.isLoading ? (
        <p className="pds-type-body-s-regular muted">{c("loading")}</p>
      ) : plans.isError ? (
        <p className="pds-type-body-m-medium error-text">{c("somethingWrong")}</p>
      ) : !sortedPlans.length ? (
        <EmptyState compact embedded icon="payments" title={t("noPaymentPlans")} />
      ) : (
        <div className={styles.planList}>
          {sortedPlans.map((plan) => {
            const active = plan.status === "active";
            return (
              <article
                key={plan.id}
                className={`${styles.planCard} ${active ? "" : styles.planCardInactive}`}
              >
                <div className={styles.planHead}>
                  <div className={styles.planHeadLeft}>
                    <span className={cn("pds-type-title-xs-bold", styles.planIcon)}>
                      <Icon name={planIcon(plan.frequency)} size={20} />
                    </span>
                    <div>
                      <h2 className={cn("pds-type-title-m-extrabold", styles.planTitle)}>{plan.name}</h2>
                      {plan.description ? (
                        <p className={cn("pds-type-body-m-medium", styles.planDescription)}>{plan.description}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className={styles.planActions}>
                    {canManage ? (
                      <>
                        <button type="button" className={cn("pds-type-body-m-bold", styles.editBtn)} onClick={() => openSchedule(plan)}>
                          <Icon name="edit" size={16} />
                          {t("editSchedule")}
                        </button>
                        <button
                          type="button"
                          className={cn("pds-type-body-s-semibold", styles.deleteBtn)}
                          onClick={() => setDeletingPlan(plan)}
                        >
                          <Icon name="delete" size={16} />
                          {c("delete")}
                        </button>
                        <button
                          type="button"
                          className={`${styles.toggle} ${active ? styles.toggleOn : ""}`}
                          aria-pressed={active}
                          aria-label={active ? t("deactivatePlan") : t("activatePlan")}
                          disabled={toggleStatus.isPending}
                          onClick={() => void toggleStatus.mutateAsync({ id: plan.id })}
                        />
                      </>
                    ) : null}
                  </div>
                </div>
                <div className={styles.schedule}>
                  <p className={cn("pds-type-label-s-medium", styles.scheduleLabel)}>{t("paymentSchedule")}</p>
                  <ul className={styles.scheduleList}>
                    {plan.installments.map((item) => (
                      <li key={item.id} className={styles.scheduleRow}>
                        <span className={cn("pds-type-body-m-medium", styles.scheduleLabelText)}>{item.label}</span>
                        <span className={cn("pds-type-body-m-medium", styles.scheduleDue)}>{item.dueDate}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <RecordFormSheet
        open={schedulePlan !== null}
        onOpenChange={(open) => {
          if (!open) {
            scheduleForm.reset();
            setFormError(null);
            setSchedulePlan(null);
          }
        }}
        title={t("editScheduleTitle", { name: schedulePlan?.name ?? "" })}
        help={t("editScheduleHelp")}
        onSubmit={scheduleForm.handleSubmit(async (values) => {
          if (!schedulePlan) return;
          setFormError(null);
          try {
            await updateInstallments.mutateAsync({
              id: schedulePlan.id,
              installments: values.installments.map((item: ScheduleFormValues["installments"][number], index: number) => ({
                label: item.label.trim(),
                dueDate: item.dueDate.trim(),
                installmentCount: item.installmentCount
                  ? Number(item.installmentCount)
                  : undefined,
                sortOrder: index
              }))
            });
            setSchedulePlan(null);
          } catch (error) {
            setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
          }
        })}
        footer={
          <>
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setSchedulePlan(null)}>
              {c("cancel")}
            </button>
            <button
              type="button"
              className="pds-type-body-m-bold btn-ghost"
              onClick={() =>
                installmentFields.append({ label: "", dueDate: "", installmentCount: "" })
              }
            >
              <Icon name="add" />
              {t("addInstallment")}
            </button>
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={scheduleForm.formState.isSubmitting}>
              {scheduleForm.formState.isSubmitting ? c("loading") : c("save")}
            </button>
          </>
        }
      >
        <div className={styles.installmentEditor}>
          {installmentFields.fields.map((field, index) => (
            <div key={field.id} className={styles.installmentRow}>
              <Field label={t("installmentLabel")}>
                <FormInput {...scheduleForm.register(`installments.${index}.label`)} />
              </Field>
              <Field label={t("installmentDue")}>
                <FormInput {...scheduleForm.register(`installments.${index}.dueDate`)} />
              </Field>
              <Field label={t("installmentCount")}>
                <FormInput
                  type="number"
                  min={1}
                  {...scheduleForm.register(`installments.${index}.installmentCount`)}
                />
              </Field>
              <button
                type="button"
                className="pds-type-body-s-regular row-action"
                disabled={installmentFields.fields.length <= 1}
                onClick={() => installmentFields.remove(index)}
              >
                {c("delete")}
              </button>
            </div>
          ))}
        </div>
        {formError ? <p className="pds-type-body-m-medium error-text">{formError}</p> : null}
      </RecordFormSheet>

      <RecordFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t("createPaymentPlan")}
        help={t("createPaymentPlanHelp")}
        onSubmit={createForm.handleSubmit(async (values) => {
          setFormError(null);
          try {
            await createPlan.mutateAsync({
              name: values.name.trim(),
              description: values.description?.trim() || "",
              frequency: values.frequency,
              installments: [{ label: t("defaultInstallmentLabel"), dueDate: "1 Jun 2026" }]
            });
            setCreateOpen(false);
          } catch (error) {
            setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
          }
        })}
        footer={
          <>
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setCreateOpen(false)}>
              {c("cancel")}
            </button>
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={createForm.formState.isSubmitting}>
              {createForm.formState.isSubmitting ? c("loading") : t("createPaymentPlan")}
            </button>
          </>
        }
      >
        <Field label={c("name")} error={createForm.formState.errors.name?.message}>
          <FormInput {...createForm.register("name")} />
        </Field>
        <Field label={t("planDescription")}>
          <textarea rows={3} {...createForm.register("description")} />
        </Field>
        <Field label={t("planFrequency")} error={createForm.formState.errors.frequency?.message}>
          <PdsSelectField
            variant="form"
            value={createForm.watch("frequency") ?? ""}
            onValueChange={(value) =>
              createForm.setValue("frequency", typeof value === "string" ? (value as (typeof FREQUENCIES)[number]) : "annual", {
                shouldValidate: true
              })
            }
            options={FREQUENCIES.map((value) => ({
              value,
              label: t(`paymentFrequencies.${value}`)
            }))}
          />
        </Field>
        {formError ? <p className="pds-type-body-m-medium error-text">{formError}</p> : null}
      </RecordFormSheet>

      <ConfirmDialog
        open={deletingPlan !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingPlan(null);
        }}
        title={t("deletePaymentPlanTitle")}
        description={t("deletePaymentPlanHelp", { name: deletingPlan?.name ?? "" })}
        confirmLabel={c("delete")}
        destructive
        loading={deletePlan.isPending}
        onConfirm={async () => {
          if (!deletingPlan) return;
          await deletePlan.mutateAsync({ id: deletingPlan.id });
          setDeletingPlan(null);
        }}
      />
    </div>
  );
}
