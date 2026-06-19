"use client";
import { FormInput } from "../../../components/shared/form-input";

import type { EnrollmentConfirmResult, EnrollmentPreviewResult } from "@sms/shared";
import { enrollmentPaymentMethods } from "@sms/shared";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, useApiMutation, useApiQuery } from "../../lib/api";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { RecordFormSheet } from "../../lib/record-sheet";
import { StudentCombobox } from "../../lib/student-combobox";
import { zodResolver } from "../../lib/zod-resolver";
import { CheckBox, CheckboxList, PdsSelectField } from "../../../components/pds";
import { Stepper } from "../../../components/shared/stepper";
import { EmptyState } from "../../../components/shared/empty-state";
import { type DiscountRuleRecord } from "../finance/discounts/discount-form";
import { RequestDiscountSheet } from "../finance/discounts/request-discount-sheet";
import { hasAnyPermission } from "../../lib/permissions";
import { getSession } from "../../lib/session";

type Classroom = { id: string; name: string; gradeId: string; academicYearId: string };

type DraftEnrollment = {
  id: string;
  studentId: string;
  classroomId: string | null;
  academicYearId?: string;
  gradeId?: string;
  status?: string;
  invoiceId?: string | null;
  billingSnapshot?: { optionalFeeItemIds?: string[] } | null;
};

type WizardValues = { studentId: string; gradeId: string; classroomId: string };

const STEPS = ["placement", "feeLines", "discounts", "invoicePreview"] as const;

type AcademicYear = { id: string; name: string };
type Grade = { id: string; name: string };

export function EnrollmentWizard({
  open,
  onOpenChange,
  classrooms,
  grades,
  academicYears,
  initialDraft,
  initialStudentId,
  initialClassroomId,
  lockStudent = false,
  lockClassroom = false,
  studentDisplayName,
  classroomDisplayName,
  extraInvalidatePaths,
  onSaved
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classrooms: Classroom[] | undefined;
  grades?: Grade[];
  academicYears?: AcademicYear[];
  initialDraft?: DraftEnrollment | null;
  initialStudentId?: string | null;
  initialClassroomId?: string | null;
  lockStudent?: boolean;
  lockClassroom?: boolean;
  studentDisplayName?: string;
  classroomDisplayName?: string;
  extraInvalidatePaths?: (tenantId: string) => string[];
  onSaved: () => void;
}) {
  const t = useTranslations("enrollments");
  const finance = useTranslations("finance");
  const c = useTranslations("common");
  const requiredMessage = c("required");

  const invalidatePaths = useCallback(
    (tenant: string) => [
      `/tenants/${tenant}/enrollments`,
      `/tenants/${tenant}/finance/invoices`,
      `/tenants/${tenant}/finance/payments`,
      ...(extraInvalidatePaths?.(tenant) ?? [])
    ],
    [extraInvalidatePaths]
  );

  const [step, setStep] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [preview, setPreview] = useState<EnrollmentPreviewResult | null>(null);
  const [optionalFeeItemIds, setOptionalFeeItemIds] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [collectPaymentAtConfirm, setCollectPaymentAtConfirm] = useState(false);
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formError, setFormError] = useState<string | null>(null);
  const [requestDiscountOpen, setRequestDiscountOpen] = useState(false);
  const [requestRuleId, setRequestRuleId] = useState<string | undefined>();
  const canRequestDiscount = hasAnyPermission(getSession()?.permissions, ["discount.request"]);

  const schema = z.object({
    studentId: z.string().uuid(requiredMessage),
    gradeId: z.string().uuid(requiredMessage),
    classroomId: z.string().uuid(requiredMessage)
  });

  const form = useForm<WizardValues>({
    resolver: zodResolver(schema),
    defaultValues: { studentId: "", gradeId: "", classroomId: "" }
  });

  const watchedStudentId = form.watch("studentId");

  type StudentDiscountRow = {
    id: string;
    discountRuleId: string;
    status: string;
  };

  const discountRules = useApiQuery<DiscountRuleRecord[]>(
    open && step === 2 && canRequestDiscount
      ? (tenant) => `/tenants/${tenant}/discounts/rules`
      : () => null
  );
  const studentDiscounts = useApiQuery<StudentDiscountRow[]>(
    open && step === 2 && canRequestDiscount && watchedStudentId
      ? (tenant) =>
          `/tenants/${tenant}/discounts/student-discounts?studentId=${watchedStudentId}`
      : () => null
  );

  const requestableRules = useMemo(() => {
    const blockedRuleIds = new Set(
      (studentDiscounts.data ?? [])
        .filter((row) => !["rejected", "archived"].includes(row.status))
        .map((row) => row.discountRuleId)
    );
    return (discountRules.data ?? []).filter(
      (rule) =>
        rule.status === "active" &&
        rule.triggerMode === "request" &&
        !blockedRuleIds.has(rule.id)
    );
  }, [discountRules.data, studentDiscounts.data]);

  const previewMutation = useApiMutation<
    {
      studentId: string;
      academicYearId: string;
      gradeId: string;
      classroomId: string;
      optionalFeeItemIds: string[];
      collectPayment?: boolean;
      paymentMethod?: string;
    },
    EnrollmentPreviewResult
  >((body, tenant) => ({
    path: `/tenants/${tenant}/enrollments/preview`,
    init: { method: "POST", body: JSON.stringify(body) }
  }));

  const saveDraft = useApiMutation<
    {
      studentId: string;
      classroomId?: string;
      academicYearId: string;
      gradeId: string;
      optionalFeeItemIds: string[];
      enquiryId?: string;
    },
    { id: string }
  >(
    (body, tenant) => ({
      path: `/tenants/${tenant}/enrollments`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => invalidatePaths(tenant) }
  );

  const updateDraft = useApiMutation<
    {
      enrollmentId: string;
      body: {
        classroomId: string;
        gradeId: string;
        academicYearId: string;
        optionalFeeItemIds: string[];
      };
    },
    { id: string }
  >(
    ({ enrollmentId, body }, tenant) => ({
      path: `/tenants/${tenant}/enrollments/${enrollmentId}`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => invalidatePaths(tenant) }
  );

  const confirmEnrollment = useApiMutation<
    {
      enrollmentId: string;
      body: {
        optionalFeeItemIds: string[];
        collectPayment: boolean;
        dueDate?: string;
        paymentMethod?: string;
        paymentAmount?: number;
        paymentReference?: string;
      };
    },
    EnrollmentConfirmResult
  >(
    ({ enrollmentId, body }, tenant) => ({
      path: `/tenants/${tenant}/enrollments/${enrollmentId}/confirm`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => invalidatePaths(tenant)
    }
  );

  const resetWizard = useCallback(() => {
    setStep(0);
    setDraftId(null);
    setPreview(null);
    setOptionalFeeItemIds([]);
    setPaymentMethod("cash");
    setPaymentReference("");
    setCollectPaymentAtConfirm(false);
    setDueDate(new Date().toISOString().slice(0, 10));
    setFormError(null);
    form.reset({ studentId: "", gradeId: "", classroomId: "" });
  }, [form]);

  const workingYearIds = new Set(academicYears?.map((year) => year.id) ?? []);
  const scopedClassrooms =
    classrooms?.filter(
      (room) => workingYearIds.size === 0 || workingYearIds.has(room.academicYearId)
    ) ?? [];

  const gradeOptions =
    grades?.filter((grade) => scopedClassrooms.some((room) => room.gradeId === grade.id)) ??
    Array.from(
      new Map(
        scopedClassrooms.map((room) => [room.gradeId, { id: room.gradeId, name: room.gradeId }])
      ).values()
    );

  const selectedGradeId = form.watch("gradeId");
  const filteredClassrooms = scopedClassrooms.filter((room) => room.gradeId === selectedGradeId);

  useEffect(() => {
    if (!open || !initialDraft?.classroomId) return;
    const cl = classrooms?.find((c) => c.id === initialDraft.classroomId);
    if (!cl) return;
    setDraftId(initialDraft.id);
    setOptionalFeeItemIds(initialDraft.billingSnapshot?.optionalFeeItemIds ?? []);
    form.reset({
      studentId: initialDraft.studentId,
      gradeId: cl.gradeId,
      classroomId: initialDraft.classroomId
    });
    void (async () => {
      try {
        const result = await previewMutation.mutateAsync({
          studentId: initialDraft.studentId,
          academicYearId: cl.academicYearId,
          gradeId: cl.gradeId,
          classroomId: cl.id,
          optionalFeeItemIds: initialDraft.billingSnapshot?.optionalFeeItemIds ?? []
        });
        setPreview(result);
        setStep(1);
      } catch (error) {
        setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume draft once per open
  }, [open, initialDraft?.id, initialDraft?.classroomId, classrooms]);

  useEffect(() => {
    if (!open || !initialDraft || initialDraft.classroomId || !initialDraft.gradeId) return;
    setDraftId(initialDraft.id);
    setOptionalFeeItemIds(initialDraft.billingSnapshot?.optionalFeeItemIds ?? []);
    setStep(0);
    form.reset({
      studentId: initialDraft.studentId,
      gradeId: initialDraft.gradeId,
      classroomId: ""
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- enquiry draft once per open
  }, [open, initialDraft?.id, initialDraft?.classroomId, initialDraft?.gradeId, form]);

  useEffect(() => {
    if (!open || initialDraft?.classroomId || initialDraft?.gradeId || !initialStudentId) return;
    const initialClassroom = initialClassroomId
      ? classrooms?.find((room) => room.id === initialClassroomId)
      : undefined;
    form.reset({
      studentId: initialStudentId,
      gradeId: initialClassroom?.gradeId ?? "",
      classroomId: initialClassroomId ?? ""
    });
  }, [open, initialDraft?.id, initialStudentId, initialClassroomId, classrooms, form]);

  useEffect(() => {
    if (!open || !lockStudent || !initialStudentId) return;
    form.setValue("studentId", initialStudentId, { shouldValidate: true });
  }, [open, lockStudent, initialStudentId, form]);

  useEffect(() => {
    if (!open || !lockClassroom || !initialClassroomId) return;
    const cl = classrooms?.find((room) => room.id === initialClassroomId);
    if (!cl) return;
    form.setValue("gradeId", cl.gradeId, { shouldValidate: true });
    form.setValue("classroomId", cl.id, { shouldValidate: true });
  }, [open, lockClassroom, initialClassroomId, classrooms, form]);

  const lockedClassroom = lockClassroom
    ? scopedClassrooms.find((room) => room.id === initialClassroomId)
    : undefined;
  const lockedGradeName =
    gradeOptions.find((grade) => grade.id === lockedClassroom?.gradeId)?.name ??
    lockedClassroom?.gradeId ??
    "";

  useEffect(() => {
    if (!selectedGradeId) return;
    const classroomId = form.getValues("classroomId");
    if (!classroomId) return;
    const stillValid = scopedClassrooms.some(
      (room) => room.id === classroomId && room.gradeId === selectedGradeId
    );
    if (!stillValid) {
      form.setValue("classroomId", "", { shouldValidate: true });
    }
  }, [selectedGradeId, scopedClassrooms, form]);

  const classroom = scopedClassrooms.find((cl) => cl.id === form.watch("classroomId"));

  const runPreview = async (
    optionalIds: string[],
    options?: { collectPayment?: boolean; paymentMethod?: string }
  ) => {
    const values = form.getValues();
    if (!classroom) {
      throw new ApiError(t("selectClassroom"), 400);
    }
    const result = await previewMutation.mutateAsync({
      studentId: values.studentId,
      academicYearId: classroom.academicYearId,
      gradeId: classroom.gradeId,
      classroomId: classroom.id,
      optionalFeeItemIds: optionalIds,
      collectPayment: options?.collectPayment,
      paymentMethod: options?.paymentMethod
    });
    setPreview(result);
    setOptionalFeeItemIds(
      result.availableOptionalFees.filter((fee) => fee.selected).map((fee) => fee.feeItemId)
    );
    return result;
  };

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat(undefined, { style: "decimal" }).format(amount);

  const setOptionalFees = async (feeItemIds: string[]) => {
    setOptionalFeeItemIds(feeItemIds);
    try {
      await runPreview(feeItemIds);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
    }
  };

  const ensureDraftId = async () => {
    if (draftId) {
      const values = form.getValues();
      if (!classroom) throw new ApiError(t("selectClassroom"), 400);
      await updateDraft.mutateAsync({
        enrollmentId: draftId,
        body: {
          classroomId: values.classroomId,
          gradeId: classroom.gradeId,
          academicYearId: classroom.academicYearId,
          optionalFeeItemIds
        }
      });
      return draftId;
    }
    const values = form.getValues();
    if (!classroom) throw new ApiError(t("selectClassroom"), 400);
    const row = await saveDraft.mutateAsync({
      studentId: values.studentId,
      classroomId: values.classroomId,
      academicYearId: classroom.academicYearId,
      gradeId: classroom.gradeId,
      optionalFeeItemIds
    });
    setDraftId(row.id);
    return row.id;
  };

  const goNext = async () => {
    setFormError(null);
    const valid = await form.trigger();
    if (!valid) return;

    if (step === 0) {
      try {
        if (draftId && classroom) {
          const values = form.getValues();
          await updateDraft.mutateAsync({
            enrollmentId: draftId,
            body: {
              classroomId: values.classroomId,
              gradeId: classroom.gradeId,
              academicYearId: classroom.academicYearId,
              optionalFeeItemIds
            }
          });
        }
        await runPreview(optionalFeeItemIds);
        setStep(1);
      } catch (error) {
        setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
      }
      return;
    }

    if (step < STEPS.length - 1) {
      if (step === 1) {
        try {
          await runPreview(optionalFeeItemIds);
        } catch (error) {
          setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
          return;
        }
      }
      setStep(step + 1);
    }
  };

  const goBack = () => {
    setFormError(null);
    if (step > 0) setStep(step - 1);
  };

  const handleSaveDraft = form.handleSubmit(async () => {
    setFormError(null);
    try {
      await ensureDraftId();
      onSaved();
      onOpenChange(false);
      resetWizard();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
    }
  });

  const handleConfirm = async (withPayment: boolean) => {
    setFormError(null);
    if (!preview) return;

    if (!preview.canConfirm) {
      setFormError(preview.confirmBlockers.join(" "));
      return;
    }

    try {
      const enrollmentId = await ensureDraftId();
      await confirmEnrollment.mutateAsync({
        enrollmentId,
        body: {
          optionalFeeItemIds,
          collectPayment: withPayment,
          dueDate,
          paymentMethod: withPayment ? paymentMethod : undefined,
          paymentAmount: withPayment ? preview.total : undefined,
          paymentReference: withPayment ? paymentReference || undefined : undefined
        }
      });
      onSaved();
      onOpenChange(false);
      resetWizard();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
    }
  };

  const busy =
    previewMutation.isPending ||
    saveDraft.isPending ||
    updateDraft.isPending ||
    confirmEnrollment.isPending ||
    form.formState.isSubmitting;

  return (
    <RecordFormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) resetWizard();
        onOpenChange(next);
      }}
      title={t("wizardTitle")}
      help={lockStudent && step === 0 ? t("wizardStep_placementLocked") : t(`wizardStep_${STEPS[step]}`)}
      onSubmit={(event) => {
        event.preventDefault();
        if (step === STEPS.length - 1) return;
        void goNext();
      }}
      footer={
        <>
          <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => onOpenChange(false)}>
            {c("cancel")}
          </button>
          {step > 0 ? (
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={goBack} disabled={busy}>
              <Icon name="arrow_back" />
              {t("wizardBack")}
            </button>
          ) : null}
          {step === STEPS.length - 1 ? (
            <>
              <button type="button" className="pds-type-body-m-bold btn-ghost" disabled={busy} onClick={() => void handleSaveDraft()}>
                <Icon name="save" />
                {t("saveDraft")}
              </button>
              <button
                type="button"
                className="pds-type-body-m-bold btn-primary"
                disabled={busy || preview?.canConfirm === false}
                onClick={() => void handleConfirm(false)}
              >
                <Icon name="how_to_reg" />
                {confirmEnrollment.isPending ? c("loading") : t("confirmEnrollment")}
              </button>
              <button
                type="button"
                className="pds-type-body-m-bold btn-primary"
                disabled={busy || preview?.canConfirm === false || !collectPaymentAtConfirm}
                onClick={() => void handleConfirm(true)}
              >
                <Icon name="payments" />
                {t("confirmAndPay")}
              </button>
            </>
          ) : (
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={busy}>
              <Icon name="arrow_forward" />
              {previewMutation.isPending ? c("loading") : t("wizardNext")}
            </button>
          )}
        </>
      }
    >
      <Stepper
        className="pds-type-body-m-medium stepper--sheet"
        steps={STEPS.map((key) => ({ id: key, label: t(`wizardStepLabel_${key}`) }))}
        currentStep={step}
        ariaLabel={t("wizardProgress")}
      />

      {step === 0 ? (
        <>
          <Field label={t("student")} error={form.formState.errors.studentId?.message}>
            {lockStudent ? (
              <FormInput value={studentDisplayName ?? ""} readOnly disabled inputClassName="input-readonly" />
            ) : (
              <StudentCombobox
                value={form.watch("studentId")}
                onChange={(nextStudentId) =>
                  form.setValue("studentId", nextStudentId, { shouldValidate: true })
                }
              />
            )}
          </Field>
          <Field label={t("grade")} error={form.formState.errors.gradeId?.message}>
            {lockClassroom && initialClassroomId ? (
              <FormInput readOnly value={lockedGradeName} inputClassName="input-readonly" />
            ) : (
              <PdsSelectField
                variant="form"
                value={selectedGradeId}
                onValueChange={(value) => {
                  const nextGradeId = typeof value === "string" ? value : "";
                  form.setValue("gradeId", nextGradeId, { shouldValidate: true });
                  form.setValue("classroomId", "", { shouldValidate: true });
                }}
                placeholder={t("selectGrade")}
                options={gradeOptions.map((grade) => ({
                  value: grade.id,
                  label: grade.name
                }))}
              />
            )}
          </Field>
          <Field label={t("classroom")} error={form.formState.errors.classroomId?.message}>
            {lockClassroom && initialClassroomId ? (
              <FormInput
                readOnly
                value={classroomDisplayName ?? lockedClassroom?.name ?? ""}
                inputClassName="input-readonly"
              />
            ) : (
              <PdsSelectField
                variant="form"
                value={form.watch("classroomId") ?? ""}
                onValueChange={(value) =>
                  form.setValue("classroomId", typeof value === "string" ? value : "", {
                    shouldValidate: true
                  })
                }
                disabled={!selectedGradeId}
                placeholder={selectedGradeId ? t("selectClassroom") : t("selectGradeFirst")}
                options={filteredClassrooms.map((cl) => ({
                  value: cl.id,
                  label: cl.name
                }))}
              />
            )}
          </Field>
        </>
      ) : null}

      {step === 1 && preview ? (
        <>
          <p className="pds-type-body-s-regular muted">{t("mandatoryFeesHint")}</p>
          {preview.feeLines.filter((line) => line.mandatory).length === 0 ? (
            <p className="pds-type-body-m-medium error-text">{t("noMandatoryFees")}</p>
          ) : (
            <ul className="preview-line-list">
              {preview.feeLines
                .filter((line) => line.mandatory)
                .map((line) => (
                  <li key={line.planId ?? line.feeItemId}>
                    <span>{line.description}</span>
                    <span>{formatAmount(line.lineTotal)} MMK</span>
                  </li>
                ))}
            </ul>
          )}
          {preview.availableOptionalFees.length > 0 ? (
            <CheckboxList
              title={t("optionalServices")}
              options={preview.availableOptionalFees.map((fee) => ({
                id: fee.feeItemId,
                label: fee.name,
                description: finance(`billingTypes.${fee.billingType}`),
                amount: fee.unitAmount,
              }))}
              selectedIds={optionalFeeItemIds}
              onChange={(ids) => void setOptionalFees(ids)}
            />
          ) : (
            <EmptyState compact embedded icon="inventory_2" title={t("noOptionalServices")} />
          )}
        </>
      ) : null}

      {step === 2 && preview ? (
        <>
          <div className={`callout${preview.siblingSummary.eligible ? " callout--success" : ""}`}>
            <strong>{t("siblingDiscount")}</strong>
            <p>{preview.siblingSummary.message}</p>
            {preview.siblingSummary.studentPosition ? (
              <p className="pds-type-body-s-regular muted">{t("siblingPosition", { position: preview.siblingSummary.studentPosition })}</p>
            ) : null}
          </div>
          {preview.pendingDiscounts.length > 0 ? (
            <div className="callout">
              <strong>{t("pendingDiscounts")}</strong>
              <p className="pds-type-body-s-regular muted">{t("pendingDiscountsHelp")}</p>
              <ul className="checkbox-list">
                {preview.pendingDiscounts.map((pending) => (
                  <li key={pending.id}>
                    {pending.ruleName} — {pending.status}: {pending.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {canRequestDiscount && requestableRules.length > 0 ? (
            <div className="callout">
              <strong>{t("requestOnlyDiscounts")}</strong>
              <p className="pds-type-body-s-regular muted">{t("requestOnlyDiscountsHelp")}</p>
              <ul className="checkbox-list">
                {requestableRules.map((rule) => (
                  <li key={rule.id} className="table-row-actions">
                    <span>{rule.name}</span>
                    <button
                      type="button"
                      className="pds-type-body-s-semibold table-row-action"
                      onClick={() => {
                        setRequestRuleId(rule.id);
                        setRequestDiscountOpen(true);
                      }}
                    >
                      {t("requestWaiver")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {preview.discountApprovalRequired ? (
            <p className="pds-type-body-s-regular muted">{t("discountApprovalRequired")}</p>
          ) : null}
          {preview.discounts.length > 0 ? (
            <ul className="discount-preview-list">
              {preview.discounts.map((discount) => (
                <li key={`${discount.source}-${discount.id}`} className="discount-preview-card panel">
                  <div className="discount-preview-card__header">
                    <strong>{discount.name}</strong>
                    <span className="discount-preview-card__amount">-{formatAmount(discount.amount)} MMK</span>
                  </div>
                  <div className="discount-preview-card__meta">
                    <span className="pds-type-body-s-regular discount-preview-card__tag">
                      {discount.source === "rule" ? t("discountSourceRule") : t("discountSourceApproved")}
                    </span>
                    {discount.stackable ? (
                      <span className="pds-type-body-s-regular discount-preview-card__tag">{t("discountStackable")}</span>
                    ) : (
                      <span className="pds-type-body-s-regular discount-preview-card__tag">{t("discountBestWins")}</span>
                    )}
                    {discount.requiresApproval ? (
                      <span className="pds-type-body-s-regular discount-preview-card__tag discount-preview-card__tag--warn">
                        {t("requiresApproval")}
                      </span>
                    ) : null}
                  </div>
                  {discount.eligibilityReason ? (
                    <p className="pds-type-body-s-regular muted discount-preview-card__reason">{discount.eligibilityReason}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact embedded icon="sell" title={t("noDiscounts")} />
          )}
          {preview.confirmBlockers.map((blocker) => (
            <p key={blocker} className="pds-type-body-m-medium error-text">
              {blocker}
            </p>
          ))}
          {preview.warnings.map((warning) => (
            <p key={warning} className="pds-type-body-s-regular muted">
              {warning}
            </p>
          ))}
        </>
      ) : null}

      {step === 3 && preview ? (
        <div className="invoice-preview">
          <ul className="preview-line-list">
            {preview.feeLines.map((line) => (
              <li key={line.planId ?? line.feeItemId}>
                <span>{line.description}</span>
                <span>{formatAmount(line.lineTotal)} MMK</span>
              </li>
            ))}
          </ul>
          {preview.discounts.length > 0 ? (
            <ul className="discount-preview-list discount-preview-list--compact">
              {preview.discounts.map((discount) => (
                <li key={`${discount.source}-${discount.id}-preview`}>
                  <span>{discount.name}</span>
                  <span>-{formatAmount(discount.amount)} MMK</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="invoice-preview__totals">
            <div>
              <span>{t("subtotal")}</span>
              <span>{formatAmount(preview.subtotal)} MMK</span>
            </div>
            <div>
              <span>{t("discountTotal")}</span>
              <span>-{formatAmount(preview.discountTotal)} MMK</span>
            </div>
            <div className="invoice-preview__grand">
              <span>{t("totalDue")}</span>
              <span>{formatAmount(preview.total)} MMK</span>
            </div>
          </div>
          <Field label={t("dueDate")}>
            <FormInput
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </Field>
          <CheckBox
            id="collect-payment-at-confirm"
            checked={collectPaymentAtConfirm}
            showDescription={false}
            label={t("collectPaymentAtConfirm")}
            onCheckedChange={(checked) => {
              setCollectPaymentAtConfirm(checked);
              void runPreview(optionalFeeItemIds, {
                collectPayment: checked,
                paymentMethod: checked ? paymentMethod : undefined,
              }).catch((error) => {
                setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
              });
            }}
          />
          {collectPaymentAtConfirm ? (
            <>
              <Field label={t("paymentMethod")}>
                <PdsSelectField
                  variant="form"
                  value={paymentMethod}
                  onValueChange={(value) => {
                    const nextMethod = typeof value === "string" ? value : "";
                    setPaymentMethod(nextMethod);
                    void runPreview(optionalFeeItemIds, {
                      collectPayment: true,
                      paymentMethod: nextMethod
                    }).catch((error) => {
                      setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
                    });
                  }}
                  options={enrollmentPaymentMethods.map((method) => ({
                    value: method,
                    label: t(`paymentMethods.${method}`)
                  }))}
                />
              </Field>
              <Field label={t("paymentReference")}>
                <FormInput
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder={t("paymentReferencePlaceholder")}
                />
              </Field>
            </>
          ) : (
            <p className="pds-type-body-s-regular muted">{t("earlyPaymentPreviewHint")}</p>
          )}
          <p className="pds-type-body-s-regular muted">{t("confirmHelp")}</p>
        </div>
      ) : step > 0 && !preview ? (
        <p className="pds-type-body-m-medium error-text">{t("previewRequired")}</p>
      ) : null}

      {formError ? (
        <p className="pds-type-body-m-medium error-text" role="alert">
          {formError}
        </p>
      ) : null}

      {canRequestDiscount && watchedStudentId ? (
        <RequestDiscountSheet
          open={requestDiscountOpen}
          onOpenChange={setRequestDiscountOpen}
          studentId={watchedStudentId}
          studentName={studentDisplayName}
          defaultRuleId={requestRuleId}
          onRequested={() => {
            void runPreview(optionalFeeItemIds).catch((error) => {
              setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
            });
          }}
        />
      ) : null}
    </RecordFormSheet>
  );
}
