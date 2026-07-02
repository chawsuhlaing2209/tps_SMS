"use client";
import { FormDatePicker, FormInput } from "../../../components/shared/form-input";

import type { EnrollmentConfirmResult, EnrollmentPreviewResult, PaymentMethod } from "@sms/shared";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, useApiMutation, useApiQuery } from "../../lib/api";
import { toastSuccess } from "../../lib/toast";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { RecordFormModal } from "../../lib/record-modal";
import { StudentCombobox } from "../../lib/student-combobox";
import { zodResolver } from "../../lib/zod-resolver";
import { InvoiceDetails, ToggleList, ToggleListItem, ToggleListSectionHead, DiscountToggleList, DiscountToggleListDivider, DiscountToggleListIntro, DiscountToggleListItem, DiscountToggleListSectionHead, DiscountToggleListTotal, mapDiscountOptionBadge } from "../../../components/pds";
import { PaymentMethodPicker, paymentMethodNeedsReference } from "../../../components/shared/payment-method-picker";
import { Stepper } from "../../../components/shared/stepper";
import { EmptyState } from "../../../components/shared/empty-state";
import { ConfirmDialog } from "../../../components/shared/confirm-dialog";
import { type DiscountRuleRecord } from "../finance/discounts/discount-form";
import { RequestDiscountSheet } from "../finance/discounts/request-discount-sheet";
import { hasAnyPermission } from "../../lib/permissions";
import { getSession } from "../../lib/session";
import {
  buildEnrollmentInvoiceDetails,
  EnrollmentChip,
  EnrollmentConfirmOption,
  EnrollmentStudentBanner,
  formatEnrollmentAmount,
  resolveOptionalFeeIcon,
} from "./enrollment-ceremony-ui";
import "./enrollment-ceremony.css";

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

type WizardValues = { studentId: string; gradeId: string; classroomId?: string };

const STEPS = ["placement", "feeLines", "discounts", "invoicePreview"] as const;

type ConfirmMode = "pay" | "confirm" | "draft";

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
  const [excludedDiscountRuleIds, setExcludedDiscountRuleIds] = useState<string[]>([]);
  const [forcedDiscountRuleIds, setForcedDiscountRuleIds] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [collectPaymentAtConfirm, setCollectPaymentAtConfirm] = useState(false);
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>("confirm");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formError, setFormError] = useState<string | null>(null);
  const [requestDiscountOpen, setRequestDiscountOpen] = useState(false);
  const [requestRuleId, setRequestRuleId] = useState<string | undefined>();
  const [deleteDraftOpen, setDeleteDraftOpen] = useState(false);
  const canRequestDiscount = hasAnyPermission(getSession()?.permissions, ["discount.request"]);

  const schema = z.object({
    studentId: z.string().uuid(requiredMessage),
    gradeId: z.string().uuid(requiredMessage),
    // Classroom is optional — a student can be enrolled into a grade before a
    // room has been planned; the room can be assigned later.
    classroomId: z.string().optional()
  });

  const form = useForm<WizardValues>({
    resolver: zodResolver(schema),
    defaultValues: { studentId: "", gradeId: "", classroomId: "" }
  });

  const watchedStudentId = form.watch("studentId");

  const selectedStudent = useApiQuery<{ fullName: string; admissionNumber?: string | null }>(
    (tenant) => (open && watchedStudentId ? `/tenants/${tenant}/students/${watchedStudentId}` : null)
  );

  // Surface the duplicate-enrollment rule at Placement (step 0) rather than only
  // at confirm: check whether the picked student already has an active enrollment
  // for this academic year.
  const placementYearId = academicYears?.[0]?.id ?? "";
  const studentEnrollments = useApiQuery<Array<{ id: string; status: string }>>((tenant) =>
    open && step === 0 && watchedStudentId && placementYearId
      ? `/tenants/${tenant}/enrollments?studentId=${watchedStudentId}&academicYearId=${placementYearId}`
      : null
  );
  const duplicateEnrollment = useMemo(() => {
    const activeStatuses = new Set(["draft", "submitted", "reviewed", "approved", "published"]);
    return (studentEnrollments.data ?? []).some(
      (row) => row.id !== initialDraft?.id && activeStatuses.has(row.status)
    );
  }, [studentEnrollments.data, initialDraft?.id]);

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
      classroomId?: string;
      optionalFeeItemIds: string[];
      excludedDiscountRuleIds?: string[];
      forcedDiscountRuleIds?: string[];
      collectPayment?: boolean;
      paymentMethod?: string;
    },
    EnrollmentPreviewResult
  >(
    (body, tenant) => ({
      path: `/tenants/${tenant}/enrollments/preview`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { showSuccessToast: false, showErrorToast: false }
  );

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
    {
      invalidatePaths: (_b, tenant) => invalidatePaths(tenant),
      showSuccessToast: false,
      showErrorToast: false
    }
  );

  const updateDraft = useApiMutation<
    {
      enrollmentId: string;
      body: {
        classroomId?: string;
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
    {
      invalidatePaths: (_b, tenant) => invalidatePaths(tenant),
      showSuccessToast: false,
      showErrorToast: false
    }
  );

  const confirmEnrollment = useApiMutation<
    {
      enrollmentId: string;
      body: {
        optionalFeeItemIds: string[];
        excludedDiscountRuleIds?: string[];
        forcedDiscountRuleIds?: string[];
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
      invalidatePaths: (_b, tenant) => invalidatePaths(tenant),
      successMessage: t("confirmSuccess"),
      showSuccessToast: true,
      showErrorToast: false
    }
  );

  const deleteDraft = useApiMutation<{ enrollmentId: string }, { id: string }>(
    ({ enrollmentId }, tenant) => ({
      path: `/tenants/${tenant}/enrollments/${enrollmentId}`,
      init: { method: "DELETE" }
    }),
    {
      invalidatePaths: (_b, tenant) => invalidatePaths(tenant),
      showSuccessToast: false,
      showErrorToast: false
    }
  );

  const resetWizard = useCallback(() => {
    setStep(0);
    setDraftId(null);
    setPreview(null);
    setOptionalFeeItemIds([]);
    setExcludedDiscountRuleIds([]);
    setForcedDiscountRuleIds([]);
    setPaymentMethod("cash");
    setPaymentReference("");
    setCollectPaymentAtConfirm(false);
    setConfirmMode("confirm");
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
  // Grade + academic year drive the fee preview and enrollment; the classroom is
  // optional. When a room is chosen it is the source of truth; otherwise fall back
  // to the selected grade and the working academic year.
  const effectiveAcademicYearId = classroom?.academicYearId ?? academicYears?.[0]?.id ?? "";
  const effectiveGradeId = classroom?.gradeId ?? selectedGradeId;

  const runPreview = async (
    optionalIds: string[],
    options?: {
      collectPayment?: boolean;
      paymentMethod?: string;
      excludedDiscountRuleIds?: string[];
      forcedDiscountRuleIds?: string[];
    }
  ) => {
    const values = form.getValues();
    if (!effectiveGradeId || !effectiveAcademicYearId) {
      throw new ApiError(t("selectGrade"), 400);
    }
    const nextExcluded = options?.excludedDiscountRuleIds ?? excludedDiscountRuleIds;
    const nextForced = options?.forcedDiscountRuleIds ?? forcedDiscountRuleIds;
    const result = await previewMutation.mutateAsync({
      studentId: values.studentId,
      academicYearId: effectiveAcademicYearId,
      gradeId: effectiveGradeId,
      classroomId: values.classroomId || undefined,
      optionalFeeItemIds: optionalIds,
      excludedDiscountRuleIds: nextExcluded,
      forcedDiscountRuleIds: nextForced,
      collectPayment: options?.collectPayment,
      paymentMethod: options?.paymentMethod
    });
    setExcludedDiscountRuleIds(nextExcluded);
    setForcedDiscountRuleIds(nextForced);
    setPreview(result);
    setOptionalFeeItemIds(
      result.availableOptionalFees.filter((fee) => fee.selected).map((fee) => fee.feeItemId)
    );
    return result;
  };

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat(undefined, { style: "decimal" }).format(amount);

  const bannerStudentName = studentDisplayName ?? selectedStudent.data?.fullName ?? "";
  const bannerStudentMeta = selectedStudent.data?.admissionNumber
    ? `#${selectedStudent.data.admissionNumber}`
    : null;
  const selectedGradeName = gradeOptions.find((grade) => grade.id === selectedGradeId)?.name ?? "";

  const invoiceDetailSections = useMemo(() => {
    if (!preview) return [];
    return buildEnrollmentInvoiceDetails(
      preview,
      {
        previewHeader: t("invoicePreviewHeader", {
          grade: selectedGradeName,
          room: classroom?.name ?? "",
        }),
        discountSection: t("discountApplied"),
        paidSection: t("paidSection"),
        paidToDate: finance("invoiceDocument.paidToDate"),
      },
    );
  }, [preview, selectedGradeName, classroom?.name, t, finance]);

  const optionalServicesSummary = useMemo(() => {
    if (!preview) return null;
    const activeFees = preview.availableOptionalFees.filter((fee) =>
      optionalFeeItemIds.includes(fee.feeItemId),
    );
    if (activeFees.length === 0) return null;
    const total = activeFees.reduce((sum, fee) => sum + fee.unitAmount, 0);
    return t("optionalServicesSummary", {
      count: activeFees.length,
      total: formatEnrollmentAmount(total),
    });
  }, [preview, optionalFeeItemIds, t]);

  const appliedDiscountOptions = useMemo(
    () => (preview?.discountOptions ?? []).filter((option) => option.applied),
    [preview?.discountOptions],
  );

  const otherDiscountOptions = useMemo(
    () => (preview?.discountOptions ?? []).filter((option) => !option.applied),
    [preview?.discountOptions],
  );

  const otherDiscountSummary = useMemo(() => {
    const active = otherDiscountOptions.filter((option) => option.applied);
    if (active.length === 0) {
      return t("discountOtherInactiveSummary");
    }
    const total = active.reduce((sum, option) => sum + option.amount, 0);
    return t("optionalServicesSummary", {
      count: active.length,
      total: formatEnrollmentAmount(total),
    });
  }, [otherDiscountOptions, t]);

  const handleDiscountToggle = (ruleId: string, checked: boolean) => {
    const nextExcluded = excludedDiscountRuleIds.filter((id) => id !== ruleId);
    const nextForced = forcedDiscountRuleIds.filter((id) => id !== ruleId);

    if (checked) {
      nextForced.push(ruleId);
    } else {
      nextExcluded.push(ruleId);
    }

    setExcludedDiscountRuleIds(nextExcluded);
    setForcedDiscountRuleIds(nextForced);

    void runPreview(optionalFeeItemIds, {
      excludedDiscountRuleIds: nextExcluded,
      forcedDiscountRuleIds: nextForced,
    }).catch((error) => {
      setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
    });
  };

  const isDiscountChecked = (option: { ruleId: string; applied: boolean }) => {
    if (excludedDiscountRuleIds.includes(option.ruleId)) return false;
    if (forcedDiscountRuleIds.includes(option.ruleId)) return true;
    return option.applied;
  };

  const handlePaymentMethodChange = (nextMethod: PaymentMethod) => {
    setPaymentMethod(nextMethod);
    if (!paymentMethodNeedsReference(nextMethod)) {
      setPaymentReference("");
    }
    void runPreview(optionalFeeItemIds, {
      collectPayment: true,
      paymentMethod: nextMethod,
    }).catch((error) => {
      setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
    });
  };

  const paymentReferenceRequired =
    confirmMode === "pay" && paymentMethodNeedsReference(paymentMethod);
  const canSubmitPayment =
    !paymentReferenceRequired || paymentReference.trim().length > 0;

  const confirmPrimaryLabel =
    confirmMode === "draft"
      ? t("saveDraft")
      : confirmMode === "pay"
        ? t("confirmAndPay")
        : t("confirmEnrollment");

  const handleConfirmModeChange = (mode: ConfirmMode) => {
    setConfirmMode(mode);
    const withPayment = mode === "pay";
    setCollectPaymentAtConfirm(withPayment);
    if (step === STEPS.length - 1) {
      void runPreview(optionalFeeItemIds, {
        collectPayment: withPayment,
        paymentMethod: withPayment ? paymentMethod : undefined,
      }).catch((error) => {
        setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
      });
    }
  };

  const handleFinalConfirm = () => {
    if (confirmMode === "draft") {
      void handleSaveDraft();
      return;
    }
    void handleConfirm(confirmMode === "pay");
  };

  const setOptionalFees = async (feeItemIds: string[]) => {
    setOptionalFeeItemIds(feeItemIds);
    try {
      await runPreview(feeItemIds);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
    }
  };

  const ensureDraftId = async () => {
    const values = form.getValues();
    if (!effectiveGradeId || !effectiveAcademicYearId) {
      throw new ApiError(t("selectGrade"), 400);
    }
    if (draftId) {
      await updateDraft.mutateAsync({
        enrollmentId: draftId,
        body: {
          classroomId: values.classroomId || undefined,
          gradeId: effectiveGradeId,
          academicYearId: effectiveAcademicYearId,
          optionalFeeItemIds
        }
      });
      return draftId;
    }
    const row = await saveDraft.mutateAsync({
      studentId: values.studentId,
      classroomId: values.classroomId || undefined,
      academicYearId: effectiveAcademicYearId,
      gradeId: effectiveGradeId,
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
      if (duplicateEnrollment) {
        setFormError(t("alreadyActiveEnrollment"));
        return;
      }
      try {
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
      toastSuccess(t("draftSavedSuccess"));
      onSaved();
      onOpenChange(false);
      resetWizard();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
    }
  });

  const handleDeleteDraft = async () => {
    if (!draftId) return;
    setFormError(null);
    try {
      await deleteDraft.mutateAsync({ enrollmentId: draftId });
      setDeleteDraftOpen(false);
      onSaved();
      onOpenChange(false);
      resetWizard();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
    }
  };

  const canDeleteDraft =
    Boolean(draftId) &&
    (initialDraft == null || (initialDraft.status === "draft" && !initialDraft.invoiceId));

  const handleConfirm = async (withPayment: boolean) => {
    setFormError(null);
    if (!preview) return;

    if (!preview.canConfirm) {
      setFormError(preview.confirmBlockers.join(" "));
      return;
    }

    if (withPayment && paymentMethodNeedsReference(paymentMethod) && !paymentReference.trim()) {
      setFormError(t("paymentReferenceRequired"));
      return;
    }

    try {
      const enrollmentId = await ensureDraftId();
      await confirmEnrollment.mutateAsync({
        enrollmentId,
        body: {
          optionalFeeItemIds,
          excludedDiscountRuleIds,
          forcedDiscountRuleIds,
          collectPayment: withPayment,
          dueDate,
          paymentMethod: withPayment ? paymentMethod : undefined,
          paymentAmount: withPayment ? preview.total : undefined,
          paymentReference:
            withPayment && paymentMethodNeedsReference(paymentMethod)
              ? paymentReference.trim() || undefined
              : undefined
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
    deleteDraft.isPending ||
    form.formState.isSubmitting;

  return (
    <RecordFormModal
      open={open}
      size="wide"
      headerVariant="withStepper"
      description={t("wizardSubtitle")}
      closeLabel={c("close")}
      stepper={
        <Stepper
          variant="ceremony"
          steps={STEPS.map((key) => ({ id: key, label: t(`wizardStepLabel_${key}`) }))}
          currentStep={step}
          ariaLabel={t("wizardProgress")}
        />
      }
      onOpenChange={(next) => {
        if (!next) resetWizard();
        onOpenChange(next);
      }}
      title={t("wizardTitle")}
      onSubmit={(event) => {
        event.preventDefault();
        if (step === STEPS.length - 1) return;
        void goNext();
      }}
      footerStart={
        canDeleteDraft ? (
          <button
            type="button"
            className="pds-type-body-m-bold btn-ghost discount-setup-footer__delete"
            disabled={busy}
            onClick={() => setDeleteDraftOpen(true)}
          >
            <Icon name="delete" />
            {c("delete")}
          </button>
        ) : null
      }
      footer={
        <>
          {step > 0 ? (
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={goBack} disabled={busy}>
              <Icon name="arrow_back" />
              {t("wizardBack")}
            </button>
          ) : null}
          {step === STEPS.length - 1 ? (
            <button
              type="button"
              className="pds-type-body-m-bold btn-primary"
              disabled={
                busy ||
                (confirmMode !== "draft" && preview?.canConfirm === false) ||
                (confirmMode === "pay" && !canSubmitPayment)
              }
              onClick={() => void handleFinalConfirm()}
            >
              <Icon name={confirmMode === "draft" ? "save" : confirmMode === "pay" ? "payments" : "how_to_reg"} />
              {confirmEnrollment.isPending || saveDraft.isPending ? c("loading") : confirmPrimaryLabel}
            </button>
          ) : (
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={busy}>
              <Icon name="arrow_forward" />
              {previewMutation.isPending ? c("loading") : t("wizardNext")}
            </button>
          )}
        </>
      }
    >
      {step === 0 ? (
        <div className="enrollment-ceremony__stack">
          {lockStudent && bannerStudentName ? (
            <EnrollmentStudentBanner
              name={bannerStudentName}
              meta={bannerStudentMeta}
              badge={t("preselected")}
            />
          ) : (
            <Field label={t("student")} error={form.formState.errors.studentId?.message}>
              <StudentCombobox
                value={form.watch("studentId")}
                onChange={(nextStudentId) =>
                  form.setValue("studentId", nextStudentId, { shouldValidate: true })
                }
              />
            </Field>
          )}
          {bannerStudentName && !lockStudent ? (
            <EnrollmentStudentBanner name={bannerStudentName} meta={bannerStudentMeta} />
          ) : null}

          {duplicateEnrollment ? (
            <p className="pds-type-body-s-regular error-text" role="alert">
              {t("alreadyActiveEnrollment")}
            </p>
          ) : null}

          <div className="enrollment-ceremony__section">
            <p className="pds-type-caption-s enrollment-ceremony__section-title">{t("grade")}</p>
            {lockClassroom && initialClassroomId ? (
              <div className="enrollment-chip-grid">
                <EnrollmentChip selected disabled>
                  {lockedGradeName}
                </EnrollmentChip>
              </div>
            ) : (
              <div className="enrollment-chip-grid">
                {gradeOptions.map((grade) => (
                  <EnrollmentChip
                    key={grade.id}
                    selected={selectedGradeId === grade.id}
                    onClick={() => {
                      form.setValue("gradeId", grade.id, { shouldValidate: true });
                      form.setValue("classroomId", "", { shouldValidate: true });
                    }}
                  >
                    {grade.name}
                  </EnrollmentChip>
                ))}
              </div>
            )}
            {form.formState.errors.gradeId?.message ? (
              <p className="pds-type-body-s-regular error-text">{form.formState.errors.gradeId.message}</p>
            ) : null}
          </div>

          <div className="enrollment-ceremony__section">
            <p className="pds-type-caption-s enrollment-ceremony__section-title">{t("classroom")}</p>
            {!selectedGradeName ? (
              <p className="pds-type-body-s-regular enrollment-ceremony__section-hint">{t("selectGrade")}</p>
            ) : null}
            {lockClassroom && initialClassroomId ? (
              <div className="enrollment-chip-grid">
                <EnrollmentChip selected disabled>
                  {classroomDisplayName ?? lockedClassroom?.name ?? ""}
                </EnrollmentChip>
              </div>
            ) : (
              <div className="enrollment-chip-grid">
                {filteredClassrooms.map((room) => (
                  <EnrollmentChip
                    key={room.id}
                    selected={form.watch("classroomId") === room.id}
                    disabled={!selectedGradeId}
                    onClick={() =>
                      form.setValue("classroomId", room.id, { shouldValidate: true })
                    }
                  >
                    {room.name}
                  </EnrollmentChip>
                ))}
              </div>
            )}
            {form.formState.errors.classroomId?.message ? (
              <p className="pds-type-body-s-regular error-text">{form.formState.errors.classroomId.message}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === 1 && preview ? (
        <div className="enrollment-ceremony__stack">
          <div className="enrollment-ceremony__section">
            <ToggleListSectionHead title={t("includedByDefault")} />
            {preview.feeLines.filter((line) => line.mandatory).length === 0 ? (
              <p className="pds-type-body-m-medium error-text">{t("noMandatoryFees")}</p>
            ) : (
              <ToggleList aria-label={t("includedByDefault")}>
                {preview.feeLines
                  .filter((line) => line.mandatory)
                  .map((line) => (
                    <ToggleListItem
                      key={line.planId ?? line.feeItemId}
                      variant="locked"
                      title={line.description}
                      description={finance(`billingTypes.${line.billingType}`)}
                      amount={line.lineTotal}
                    />
                  ))}
              </ToggleList>
            )}
          </div>

          {preview.availableOptionalFees.length > 0 ? (
            <div className="enrollment-ceremony__section">
              <ToggleListSectionHead title={t("optionalAddOns")} summary={optionalServicesSummary} />
              <ToggleList aria-label={t("optionalAddOns")}>
                {preview.availableOptionalFees.map((fee) => {
                  const selected = optionalFeeItemIds.includes(fee.feeItemId);
                  const { icon, tone } = resolveOptionalFeeIcon(fee.name, fee.feeType);
                  return (
                    <ToggleListItem
                      key={fee.feeItemId}
                      variant="toggle"
                      icon={icon}
                      iconTone={tone}
                      title={fee.name}
                      amount={fee.unitAmount}
                      checked={selected}
                      onCheckedChange={(checked) => {
                        const next = checked
                          ? [...optionalFeeItemIds, fee.feeItemId]
                          : optionalFeeItemIds.filter((id) => id !== fee.feeItemId);
                        void setOptionalFees(next);
                      }}
                    />
                  );
                })}
              </ToggleList>
            </div>
          ) : (
            <EmptyState compact embedded icon="inventory_2" title={t("noOptionalServices")} />
          )}

          <div className="enrollment-services-subtotal">
            <p className="pds-type-body-s-bold enrollment-services-subtotal__label">{t("servicesSubtotal")}</p>
            <p className="enrollment-services-subtotal__value">
              <span className="pds-type-title-xl-extrabold enrollment-services-subtotal__amount">
                {formatEnrollmentAmount(preview.subtotal)}
              </span>
              <span className="pds-type-caption-s enrollment-services-subtotal__currency">MMK</span>
            </p>
          </div>
        </div>
      ) : null}

      {step === 2 && preview ? (
        <div className="enrollment-ceremony__stack">
          <DiscountToggleListIntro>{t("discountsStepIntro")}</DiscountToggleListIntro>

          {appliedDiscountOptions.length > 0 ? (
            <div className="pds-discount-toggle-list__section">
              <DiscountToggleList aria-label={t("discountAutoAppliedSection")}>
                {appliedDiscountOptions.map((option) => {
                  const badge = mapDiscountOptionBadge(option, {
                    autoApplied: t("discountBadgeAutoApplied"),
                    eligible: t("discountBadgeEligible"),
                    notEligible: t("discountBadgeNotEligible"),
                  });
                  return (
                    <DiscountToggleListItem
                      key={option.ruleId}
                      title={option.name}
                      subtitle={option.subtitle}
                      amount={option.amount}
                      badge={badge.label}
                      badgeTone={badge.tone}
                      checked={isDiscountChecked(option)}
                      applied
                      ariaLabel={option.name}
                      onCheckedChange={(checked) => handleDiscountToggle(option.ruleId, checked)}
                    />
                  );
                })}
              </DiscountToggleList>
            </div>
          ) : null}

          {otherDiscountOptions.length > 0 ? (
            <>
              <DiscountToggleListDivider />
              <div className="pds-discount-toggle-list__section">
                <DiscountToggleListSectionHead
                  title={t("otherEligibleDiscounts")}
                  summary={otherDiscountSummary}
                />
                <DiscountToggleList aria-label={t("otherEligibleDiscounts")}>
                  {otherDiscountOptions.map((option) => {
                    const badge = mapDiscountOptionBadge(option, {
                      autoApplied: t("discountBadgeAutoApplied"),
                      eligible: t("discountBadgeEligible"),
                      notEligible: t("discountBadgeNotEligible"),
                    });
                    return (
                      <DiscountToggleListItem
                        key={option.ruleId}
                        title={option.name}
                        subtitle={option.subtitle}
                        amount={option.amount}
                        badge={badge.label}
                        badgeTone={badge.tone}
                        checked={isDiscountChecked(option)}
                        disabled={!option.canToggle}
                        ariaLabel={option.name}
                        onCheckedChange={(checked) => handleDiscountToggle(option.ruleId, checked)}
                      />
                    );
                  })}
                </DiscountToggleList>
              </div>
            </>
          ) : appliedDiscountOptions.length === 0 ? (
            <EmptyState compact embedded icon="sell" title={t("noDiscounts")} />
          ) : null}

          <DiscountToggleListTotal
            label={t("totalDiscounts")}
            amount={preview.discountTotal}
          />

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
        </div>
      ) : null}

      {step === 3 && preview ? (
        <div className="enrollment-ceremony__stack">
          <InvoiceDetails
            sections={invoiceDetailSections}
            totalDue={preview.total}
            totalLabel={t("totalDue")}
            currencyLabel="MMK"
            formatAmount={formatEnrollmentAmount}
          />

          <Field label={t("dueDate")}>
            <FormDatePicker
              type="day"
              variant="form"
              value={dueDate}
              onValueChange={setDueDate}
              placeholder={t("dueDate")}
              ariaLabel={t("dueDate")}
            />
          </Field>

          <div className="enrollment-ceremony__section">
            <p className="pds-type-caption-s enrollment-ceremony__section-title">{t("confirmHelp")}</p>
            <div className="enrollment-confirm-options">
              <EnrollmentConfirmOption
                icon="payments"
                title={t("confirmPayTitle")}
                hint={t("confirmPayHint")}
                selected={confirmMode === "pay"}
                onSelect={() => handleConfirmModeChange("pay")}
              />
              <EnrollmentConfirmOption
                icon="how_to_reg"
                title={t("confirmOnlyTitle")}
                hint={t("confirmOnlyHint")}
                selected={confirmMode === "confirm"}
                onSelect={() => handleConfirmModeChange("confirm")}
              />
              <EnrollmentConfirmOption
                icon="save"
                title={t("saveDraftTitle")}
                hint={t("saveDraftHint")}
                selected={confirmMode === "draft"}
                onSelect={() => handleConfirmModeChange("draft")}
              />
            </div>
          </div>

          {confirmMode === "pay" ? (
            <div className="enrollment-ceremony__payment-fields">
              <PaymentMethodPicker
                value={paymentMethod}
                label={t("paymentMethod")}
                onChange={handlePaymentMethodChange}
              />
              {paymentReferenceRequired ? (
                <Field label={t("paymentReference")}>
                  <FormInput
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder={t("paymentReferencePlaceholder")}
                  />
                </Field>
              ) : null}
            </div>
          ) : confirmMode === "confirm" ? (
            <p className="pds-type-body-s-regular muted">{t("earlyPaymentPreviewHint")}</p>
          ) : null}
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
          studentName={bannerStudentName || studentDisplayName}
          defaultRuleId={requestRuleId}
          onRequested={() => {
            void runPreview(optionalFeeItemIds).catch((error) => {
              setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
            });
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleteDraftOpen}
        onOpenChange={setDeleteDraftOpen}
        title={t("deleteDraftTitle")}
        description={t("deleteDraftHelp")}
        confirmLabel={c("delete")}
        cancelLabel={c("cancel")}
        destructive
        loading={deleteDraft.isPending}
        onConfirm={() => void handleDeleteDraft()}
      />
    </RecordFormModal>
  );
}
