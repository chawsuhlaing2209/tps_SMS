"use client";
import { FormInput } from "../../../../components/shared/form-input";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, use } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { SegmentedControl } from "../../../../components/pds/composites/segmented-control";
import { ConfirmDialog } from "../../../../components/shared/confirm-dialog";
import { EmptyState } from "../../../../components/shared/empty-state";
import { Button } from "../../../../components/ui/button";
import { StatusPill } from "../../../../components/pds/subcomponents/status-pill";
import { StatusBadge } from "../../../../components/shared/badge";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { DataTable } from "../../../lib/data-table";
import { Field } from "../../../lib/form";
import { HeroMoreActionsMenu, HeroPrimaryAction } from "../../../lib/hero-more-actions";
import { Icon } from "../../../lib/material-icon";
import { hasAnyPermission } from "../../../lib/permissions";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { RecordList, RecordListItem, RecordListPanel } from "../../../lib/record-list";
import { getSession } from "../../../lib/session";
import { TablePanelBody, DataTableSection } from "../../../lib/table-panel";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { zodResolver } from "../../../lib/zod-resolver";
import { navigateWithTrail } from "../../../lib/navigation-trail";
import { EnrollmentWizard } from "../../enrollments/enrollment-wizard";
import { RequestDiscountSheet } from "../../finance/discounts/request-discount-sheet";
import { PageHeader } from "../../page-header-context";
import { StudentFamilyPanel } from "../student-family-panel";
import { StudentRecurrentBillingPanel } from "../student-recurrent-billing-panel";
import { StudentDocumentsPanel } from "../student-documents-panel";

type StudentProfile = {
  id: string;
  fullName: string;
  admissionNumber: string;
  status: string;
  familyGroupId: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  medicalNotes: string | null;
  guardians: Array<{
    student_guardians: { relationship: string };
    guardians: { id: string; fullName: string; phone: string | null; email: string | null };
  }>;
  classrooms: Array<{
    classroom_students: { effectiveFrom: string; effectiveTo: string | null };
    classrooms: { id: string; name: string };
  }>;
  profile: {
    classroomName: string | null;
    gradeName: string | null;
    streamLabel: string | null;
    enrolledAt: string | null;
    attendancePercent: number | null;
    termGpa: number | null;
    feeStatus: "none" | "paid_in_full" | "partial" | "outstanding";
    primaryGuardian: {
      id: string;
      fullName: string;
      phone: string | null;
      relationship: string;
    } | null;
    subjects: Array<{ id: string; name: string; code: string | null }>;
  };
};

type Grade = { id: string; name: string };
type ClassroomOption = { id: string; name: string; gradeId: string; academicYearId: string };

type Enrollment = {
  id: string;
  studentId: string;
  classroomId: string | null;
  academicYearId: string;
  gradeId: string;
  invoiceId: string | null;
  status: string;
  billingSnapshot?: { optionalFeeItemIds?: string[] } | null;
  updatedAt?: string;
};

type MembershipRow = {
  id: string;
  classroomId: string | null;
  classroomName: string;
  gradeName: string;
  startDate: string | null;
  status: string;
  lastUpdated: string | null;
  enrollment: Enrollment | null;
};

type StudentBillingSummary = {
  totalOutstanding: number;
  totalPaid: number;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    source: "enrollment" | "recurring" | "ad_hoc";
    total: string;
    status: string;
    issueDate: string;
  }>;
  activeServices: Array<{
    id: string;
    feeItemId: string;
    feeItemName: string;
    billingType: string;
    effectiveFrom: string;
    monthlyAmount?: number | null;
  }>;
  discounts: Array<{
    id: string;
    ruleName: string;
    status: string;
    reason: string;
  }>;
};

type ProfileTab = "overview" | "family" | "billing" | "documents";

const ACTIVE_STATUSES = new Set(["draft", "enrolled", "transferred"]);

function studentInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
  }
  return fullName.slice(0, 2).toUpperCase();
}

function formatMonthYear(value: string | null) {
  if (!value) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(
    new Date(value)
  );
}

function formatShortDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatRelativeUpdated(value: string | null | undefined, todayLabel: string) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  const now = new Date();
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return `${todayLabel} · ${time}`;
  }
  const dayLabel = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short"
  }).format(date);
  return `${dayLabel} · ${time}`;
}

function parseProfileTab(value: string | null, canViewFinance: boolean): ProfileTab {
  if (value === "family") {
    return "family";
  }
  if (value === "billing" && canViewFinance) {
    return "billing";
  }
  if (value === "documents") {
    return "documents";
  }
  return "overview";
}

export default function StudentDetailPage({
  params
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentHref = `/dashboard/students/${studentId}`;
  const t = useTranslations("students");
  const e = useTranslations("enrollments");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["student.manage"]);
  const canViewFinance = hasAnyPermission(permissions, ["finance.manage"]);
  const canRequestDiscount = hasAnyPermission(permissions, ["discount.request"]);
  const f = useTranslations("finance");
  const d = useTranslations("discounts");
  const currentYear = useCurrentAcademicYear();

  const activeTab = parseProfileTab(searchParams.get("tab"), canViewFinance);

  const setActiveTab = useCallback(
    (tab: ProfileTab) => {
      const next = new URLSearchParams(searchParams.toString());
      if (tab === "overview") {
        next.delete("tab");
      } else {
        next.set("tab", tab);
      }
      const query = next.toString();
      router.replace(query ? `${studentHref}?${query}` : studentHref, { scroll: false });
    },
    [router, searchParams, studentHref]
  );

  const student = useApiQuery<StudentProfile>(
    (tenant) => `/tenants/${tenant}/students/${studentId}/profile`
  );

  const classrooms = useApiQuery<ClassroomOption[]>((tenant) => `/tenants/${tenant}/classrooms`);
  const grades = useApiQuery<Grade[]>((tenant) => `/tenants/${tenant}/academics/grades`);
  const enrollments = useApiQuery<Enrollment[]>(
    (tenant) => `/tenants/${tenant}/enrollments?studentId=${studentId}`
  );

  const billing = useApiQuery<StudentBillingSummary>((tenant) =>
    canViewFinance ? `/tenants/${tenant}/finance/students/${studentId}/summary` : null
  );

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState<"deactivate" | "activate" | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<Enrollment | null>(null);
  const [requestDiscountOpen, setRequestDiscountOpen] = useState(false);

  const update = useApiMutation<
    {
      firstName?: string;
      lastName?: string;
      address?: string;
      medicalNotes?: string;
      status?: string;
    },
    StudentProfile
  >(
    (body, tenant) => ({
      path: `/tenants/${tenant}/students/${studentId}`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `/tenants/${tenant}/students/${studentId}/profile`,
        `/tenants/${tenant}/students`
      ]
    }
  );

  const updateGuardian = useApiMutation<
    { guardianId: string; firstName?: string; lastName?: string; phone?: string },
    unknown
  >(
    (body, tenant) => ({
      path: `/tenants/${tenant}/students/guardians/${body.guardianId}`,
      init: {
        method: "PATCH",
        body: JSON.stringify({
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone
        })
      }
    }),
    {
      invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/students/${studentId}/profile`]
    }
  );

  const createGuardian = useApiMutation<
    {
      firstName: string;
      lastName: string;
      relationship: "father" | "mother" | "guardian" | "other";
      phone: string;
    },
    { id: string }
  >(
    (body, tenant) => ({
      path: `/tenants/${tenant}/students/guardians`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/students/${studentId}/profile`]
    }
  );

  const linkGuardian = useApiMutation<{
    guardianId: string;
    relationship: "father" | "mother" | "guardian" | "other";
  }>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/students/${studentId}/guardians`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/students/${studentId}/profile`] }
  );

  const editSchema = z.object({
    firstName: z.string().trim().min(1, c("required")),
    lastName: z.string().trim().min(1, c("required")),
    address: z.string(),
    medicalNotes: z.string(),
    guardianFirstName: z.string(),
    guardianLastName: z.string(),
    guardianPhone: z.string()
  });

  const nameParts = student.data?.fullName.split(" ") ?? [];
  const guardian = student.data?.profile.primaryGuardian;
  const guardianNameParts = guardian?.fullName.split(" ") ?? [];

  const editForm = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    values: {
      firstName: nameParts[0] ?? "",
      lastName: nameParts.slice(1).join(" ") ?? "",
      address: student.data?.address ?? "",
      medicalNotes: student.data?.medicalNotes ?? "",
      guardianFirstName: guardianNameParts[0] ?? "",
      guardianLastName: guardianNameParts.slice(1).join(" ") ?? "",
      guardianPhone: guardian?.phone ?? ""
    }
  });

  const isActive = student.data ? ACTIVE_STATUSES.has(student.data.status) : false;

  const classroomName = (id: string | null) =>
    id ? (classrooms.data?.find((room) => room.id === id)?.name ?? id) : "—";
  const gradeName = (id: string) => grades.data?.find((grade) => grade.id === id)?.name ?? id;

  const openEnrollmentWizard = (draft: Enrollment | null = null) => {
    setResumeDraft(draft);
    setWizardOpen(true);
  };

  const refreshEnrollmentData = () => {
    void student.refetch();
    void enrollments.refetch();
  };

  const membershipRows = useMemo((): MembershipRow[] => {
    if (!student.data) {
      return [];
    }

    if (enrollments.data?.length) {
      return enrollments.data.map((row) => {
        const placement = student.data!.classrooms.find(
          (item) => item.classrooms.id === row.classroomId
        );
        return {
          id: row.id,
          classroomId: row.classroomId,
          classroomName: classroomName(row.classroomId),
          gradeName: gradeName(row.gradeId),
          startDate: placement?.classroom_students.effectiveFrom ?? null,
          status: row.status,
          lastUpdated: row.updatedAt ?? null,
          enrollment: row
        };
      });
    }

    return student.data.classrooms.map((row) => ({
      id: `${row.classrooms.id}-${row.classroom_students.effectiveFrom}`,
      classroomId: row.classrooms.id,
      classroomName: row.classrooms.name,
      gradeName: student.data!.profile?.gradeName ?? "—",
      startDate: row.classroom_students.effectiveFrom,
      status: row.classroom_students.effectiveTo == null ? "active" : "archived",
      lastUpdated: null,
      enrollment: null
    }));
  }, [enrollments.data, student.data, classrooms.data, grades.data]);

  const membershipColumns: ColumnDef<MembershipRow, unknown>[] = [
    { id: "classroom", header: t("membershipClass"), accessorKey: "classroomName" },
    { id: "grade", header: t("membershipGrade"), accessorKey: "gradeName" },
    {
      id: "startDate",
      header: t("membershipStartDate"),
      accessorFn: (row) => formatShortDate(row.startDate)
    },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status}
          label={
            row.original.status === "active"
              ? t("placementActive")
              : row.original.status === "archived" && !row.original.enrollment
                ? t("membershipCompleted")
                : row.original.enrollment
                  ? e(`status_${row.original.status}` as "status_draft")
                  : t(`status_${row.original.status}` as "status_archived")
          }
        />
      )
    },
    {
      id: "lastUpdated",
      header: t("membershipLastUpdated"),
      accessorFn: (row) => formatRelativeUpdated(row.lastUpdated ?? row.startDate, t("updatedToday"))
    },
    {
      id: "details",
      header: t("membershipDetails"),
      enableSorting: false,
      cell: ({ row }) => {
        const enrollment = row.original.enrollment;
        if (enrollment?.status === "draft" && !enrollment.invoiceId) {
          return (
            <button
              type="button"
              className="pds-type-body-s-regular row-action"
              onClick={() => openEnrollmentWizard(enrollment)}
            >
              {e("continueEnrollment")}
            </button>
          );
        }
        if (enrollment?.status === "approved" && !enrollment.invoiceId) {
          return (
            <button
              type="button"
              className="pds-type-body-s-regular row-action"
              onClick={() => openEnrollmentWizard(enrollment)}
            >
              {e("continueEnrollment")}
            </button>
          );
        }
        if (enrollment?.invoiceId) {
          return (
            <Link
              className="pds-type-body-s-regular row-action"
              href={`/dashboard/finance/invoices/${enrollment.invoiceId}`}
            >
              {e("viewInvoice")}
            </Link>
          );
        }
        if (row.original.classroomId) {
          return (
            <Link
              className="pds-type-body-s-regular row-action"
              href={`/dashboard/structure/rooms/${row.original.classroomId}`}
            >
              {t("membershipDetailsLink")}
            </Link>
          );
        }
        return "—";
      }
    }
  ];

  const heroMeta = useMemo(() => {
    if (!student.data) {
      return "";
    }
    const { profile: heroProfile, admissionNumber } = student.data;
    const bits = [
      `${t("rollLabel")} ${admissionNumber}`,
      heroProfile.gradeName && heroProfile.classroomName
        ? `${heroProfile.gradeName} · ${heroProfile.classroomName}`
        : heroProfile.gradeName ?? heroProfile.classroomName,
      heroProfile.streamLabel ? `${heroProfile.streamLabel} ${t("streamSuffix")}` : null,
      heroProfile.enrolledAt
        ? t("enrolledMeta", {
            date: formatMonthYear(heroProfile.enrolledAt) ?? heroProfile.enrolledAt
          })
        : null
    ].filter(Boolean);
    return bits.join(" · ");
  }, [student.data, t]);

  const data = student.data;
  const profile = data?.profile;

  const linkedGuardians = useMemo(
    () =>
      data?.guardians.map((row) => ({
        id: row.guardians.id,
        fullName: row.guardians.fullName,
        phone: row.guardians.phone,
        email: row.guardians.email,
        relationship: row.student_guardians.relationship
      })) ?? [],
    [data?.guardians]
  );

  const tabOptions = useMemo(() => {
    const options = [
      { id: "overview", label: t("tabOverview") },
      { id: "family", label: t("tabFamily") }
    ];
    if (canViewFinance) {
      options.push({ id: "billing", label: t("tabBilling") });
    }
    options.push({ id: "documents", label: t("tabDocuments") });
    return options;
  }, [canViewFinance, t]);

  async function handleStatusToggle(nextChecked: boolean) {
    if (!canManage) {
      return;
    }
    setStatusConfirm(nextChecked ? "activate" : "deactivate");
  }

  async function confirmStatusChange() {
    if (!statusConfirm) {
      return;
    }
    await update.mutateAsync({
      status: statusConfirm === "activate" ? "enrolled" : "withdrawn"
    });
    setStatusConfirm(null);
  }

  async function handleDelete() {
    await update.mutateAsync({ status: "archived" });
    setDeleteOpen(false);
    router.push("/dashboard/people?tab=students");
  }

  return (
    <div className="student-profile-page">
      <PageHeader
        title={data?.fullName ?? t("profileTitle")}
        segment={{ label: data?.fullName ?? t("profileTitle"), href: studentHref }}
        breadcrumbs={[
          { label: nav("students"), href: "/dashboard/people?tab=students" },
          { label: data?.fullName ?? t("profileTitle") }
        ]}
      />

      {student.isLoading ? <p className="pds-type-body-s-regular muted">{c("loading")}</p> : null}

      {!student.isLoading && (student.isError || !data) ? (
        <div className="page-stack">
          <p className="pds-type-body-m-medium error-text">{t("notFound")}</p>
        </div>
      ) : null}

      {data && profile ? (
        <>
          <Link href="/dashboard/people?tab=students" className="page-back-link">
            <Icon name="arrow_back" size={18} />
            {t("backToPeople")}
          </Link>

          <section className="structure-room-banner student-profile-banner">
            <div className="structure-room-banner__main student-profile-banner__main">
              <span className="student-profile-avatar">{studentInitials(data.fullName)}</span>
              <div>
                <div className="student-profile-banner__title-row">
                  <h2 className="structure-room-banner__title">{data.fullName}</h2>
                  <StatusPill tone={isActive ? "active" : "inactive"}>
                    {isActive ? t("statusActive") : t("statusInactive")}
                  </StatusPill>
                </div>
                <p className="pds-type-body-s-regular structure-room-banner__meta">{heroMeta}</p>
              </div>
            </div>
            <div className="structure-room-banner__actions student-profile-banner__actions">
              <HeroPrimaryAction
                onClick={() =>
                  navigateWithTrail(
                    router,
                    `/dashboard/exams/report-cards?studentId=${studentId}`,
                    { label: data.fullName, href: studentHref }
                  )
                }
              >
                <Icon name="grading" />
                {t("reportCard")}
              </HeroPrimaryAction>
              {canManage ? (
                <HeroMoreActionsMenu
                  label={t("moreActions")}
                  items={[
                    {
                      id: "message",
                      label: t("messageGuardian"),
                      icon: "send",
                      onSelect: () => {
                        const phone = profile.primaryGuardian?.phone?.replace(/\s+/g, "");
                        if (phone) {
                          window.location.href = `tel:${phone}`;
                        } else {
                          router.push("/dashboard/communication");
                        }
                      }
                    },
                    {
                      id: "edit",
                      label: t("editProfile"),
                      icon: "edit",
                      onSelect: () => setEditOpen(true)
                    },
                    {
                      id: "active",
                      label: isActive ? t("setAsInactive") : t("markActive"),
                      icon: isActive ? "pause_circle" : "check_circle",
                      onSelect: () => void handleStatusToggle(!isActive)
                    },
                    {
                      id: "delete",
                      label: c("delete"),
                      icon: "delete",
                      destructive: true,
                      onSelect: () => setDeleteOpen(true)
                    }
                  ]}
                />
              ) : null}
            </div>
          </section>

          <div className="student-profile-stats">
            <article className="student-profile-stat">
              <span className="pds-type-body-s-regular student-profile-stat__label">
                {t("attendanceStat")}
              </span>
              <strong className="student-profile-stat__value">
                {profile.attendancePercent != null ? `${profile.attendancePercent}%` : "—"}
              </strong>
            </article>
            <article className="student-profile-stat">
              <span className="pds-type-body-s-regular student-profile-stat__label">
                {t("termGpaStat")}
              </span>
              <strong className="student-profile-stat__value">
                {profile.termGpa != null ? profile.termGpa.toFixed(1) : "—"}
              </strong>
            </article>
            <article className="student-profile-stat">
              <span className="pds-type-body-s-regular student-profile-stat__label">
                {t("bestMonthStat")}
              </span>
              <strong className="student-profile-stat__value">{t("bestMonthPlaceholder")}</strong>
            </article>
            <article className="student-profile-stat">
              <span className="pds-type-body-s-regular student-profile-stat__label">
                {t("guardianStat")}
              </span>
              {profile.primaryGuardian ? (
                <>
                  <strong className="student-profile-stat__value student-profile-stat__value--compact">
                    {profile.primaryGuardian.fullName}
                  </strong>
                  <span className="pds-type-body-m-medium student-profile-stat__sub">
                    {profile.primaryGuardian.phone ?? t("noGuardianPhone")}
                  </span>
                </>
              ) : (
                <strong className="student-profile-stat__value">—</strong>
              )}
            </article>
          </div>

          <SegmentedControl
            className="student-profile-tabs"
            ariaLabel={t("profileTabsAria")}
            options={tabOptions}
            value={activeTab}
            onChange={(id) => setActiveTab(id as ProfileTab)}
          />

          {activeTab === "overview" ? (
            <div className="student-profile-tab-content">
              <div className="panel student-profile-tab-panel">
                <div className="dash-page-title">
                  <h2 className="pds-type-title-s-extrabold dash-page-title__heading">
                    {t("classroomMembershipsTitle")}
                  </h2>
                  <div className="dash-page-title__actions">
                    {canManage ? (
                      <Button
                        type="button"
                        buttonType="filled"
                        buttonColor="secondary"
                        prefixIcon="add"
                        onClick={() => openEnrollmentWizard(null)}
                      >
                        {t("enrollStudentCta")}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <DataTableSection>
                  <TablePanelBody
                    variant="plain"
                    loading={enrollments.isLoading}
                    error={enrollments.isError ? c("somethingWrong") : null}
                    empty={!membershipRows.length}
                    emptyIcon="school"
                    emptyTitle={t("noEnrollmentsYet")}
                    emptyAction={
                      canManage ? (
                        <Button
                          type="button"
                          buttonType="filled"
                          buttonColor="secondary"
                          prefixIcon="add"
                          onClick={() => openEnrollmentWizard(null)}
                        >
                          {t("enrollStudentCta")}
                        </Button>
                      ) : undefined
                    }
                  >
                    {membershipRows.length ? (
                      <DataTable columns={membershipColumns} data={membershipRows} />
                    ) : null}
                  </TablePanelBody>
                </DataTableSection>
              </div>

              <RecordListPanel
                title={t("subjectsThisTerm")}
                empty={!profile.subjects.length ? t("noSubjectsThisTerm") : undefined}
              >
                {profile.subjects.length ? (
                  <RecordList className="pds-entity-list--two-col">
                    {profile.subjects.map((subject) => (
                      <RecordListItem
                        key={subject.id}
                        nameForColor={subject.name}
                        title={subject.name}
                        trailing={
                          isActive ? (
                            <span className="record-list-item__badge">{t("onTrack")}</span>
                          ) : undefined
                        }
                      />
                    ))}
                  </RecordList>
                ) : null}
              </RecordListPanel>
            </div>
          ) : null}

          {activeTab === "family" ? (
            <div className="student-profile-tab-content">
              <StudentFamilyPanel
                variant="tab"
                studentId={studentId}
                familyGroupId={data.familyGroupId}
                guardians={linkedGuardians}
                primaryGuardian={
                  profile.primaryGuardian
                    ? { id: profile.primaryGuardian.id, fullName: profile.primaryGuardian.fullName }
                    : null
                }
                hasGuardian={data.guardians.length > 0 || Boolean(profile.primaryGuardian)}
                canManage={canManage}
                onUpdated={() => void student.refetch()}
                sectionTitle={t("familyTitle")}
              />
            </div>
          ) : null}

          {activeTab === "billing" && canViewFinance ? (
            <div className="student-profile-tab-content">
              <div className="panel student-profile-tab-panel student-profile-tab-panel--billing">
                <div className="dash-page-title">
                  <h2 className="pds-type-title-s-extrabold dash-page-title__heading">
                    {t("recurrentBillingTitle")}
                  </h2>
                  <div className="dash-page-title__actions">
                    {canRequestDiscount ? (
                      <button
                        type="button"
                        className="pds-type-body-m-bold btn-ghost"
                        onClick={() => setRequestDiscountOpen(true)}
                      >
                        <Icon name="volunteer_activism" size={18} />
                        {d("request")}
                      </button>
                    ) : null}
                  </div>
                </div>
                <StudentRecurrentBillingPanel
                  studentId={studentId}
                  data={billing.data}
                  loading={billing.isLoading}
                  error={billing.isError}
                  canManage={canManage}
                  onRefresh={() => void billing.refetch()}
                />
              </div>
            </div>
          ) : null}

          {activeTab === "documents" ? (
            <div className="student-profile-tab-content">
              <StudentDocumentsPanel studentId={studentId} canManage={canManage} />
            </div>
          ) : null}

          {canManage ? (
            <>
              <RecordFormSheet
                open={editOpen}
                onOpenChange={setEditOpen}
                title={t("editProfileTitle")}
                help={t("editProfileHelp")}
                onSubmit={editForm.handleSubmit(async (values) => {
                  await update.mutateAsync({
                    firstName: values.firstName,
                    lastName: values.lastName,
                    address: values.address,
                    medicalNotes: values.medicalNotes
                  });

                  if (
                    values.guardianFirstName.trim() &&
                    values.guardianLastName.trim() &&
                    values.guardianPhone.trim()
                  ) {
                    if (guardian) {
                      await updateGuardian.mutateAsync({
                        guardianId: guardian.id,
                        firstName: values.guardianFirstName,
                        lastName: values.guardianLastName,
                        phone: values.guardianPhone
                      });
                    } else {
                      const created = await createGuardian.mutateAsync({
                        firstName: values.guardianFirstName,
                        lastName: values.guardianLastName,
                        relationship: "guardian",
                        phone: values.guardianPhone
                      });
                      await linkGuardian.mutateAsync({
                        guardianId: created.id,
                        relationship: "guardian"
                      });
                    }
                  }

                  setEditOpen(false);
                })}
                footer={
                  <>
                    <button
                      type="button"
                      className="pds-type-body-m-bold btn-ghost"
                      onClick={() => setEditOpen(false)}
                    >
                      {c("cancel")}
                    </button>
                    <button
                      type="submit"
                      className="pds-type-body-m-bold btn-primary"
                      disabled={
                        update.isPending || updateGuardian.isPending || createGuardian.isPending
                      }
                    >
                      <Icon name="check" />
                      {update.isPending ? c("loading") : c("save")}
                    </button>
                  </>
                }
              >
                <Field label={t("firstName")} error={editForm.formState.errors.firstName?.message}>
                  <FormInput {...editForm.register("firstName")} />
                </Field>
                <Field label={t("lastName")} error={editForm.formState.errors.lastName?.message}>
                  <FormInput {...editForm.register("lastName")} />
                </Field>
                <Field label={t("address")}>
                  <FormInput {...editForm.register("address")} />
                </Field>
                <Field label={t("medicalNotes")}>
                  <textarea {...editForm.register("medicalNotes")} rows={3} />
                </Field>
                <div className="student-profile-edit-divider">
                  <h4>{t("guardianContactTitle")}</h4>
                  <p className="pds-type-body-s-regular muted">{t("guardianContactHelp")}</p>
                </div>
                <Field label={t("guardianFirstName")}>
                  <FormInput {...editForm.register("guardianFirstName")} />
                </Field>
                <Field label={t("guardianLastName")}>
                  <FormInput {...editForm.register("guardianLastName")} />
                </Field>
                <Field label={t("guardianPhone")}>
                  <FormInput {...editForm.register("guardianPhone")} />
                </Field>
              </RecordFormSheet>

              <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title={t("deleteStudentTitle")}
                description={t("deleteStudentHelp")}
                confirmLabel={c("delete")}
                cancelLabel={c("cancel")}
                destructive
                loading={update.isPending}
                onConfirm={() => void handleDelete()}
              />

              <ConfirmDialog
                open={statusConfirm !== null}
                onOpenChange={(open) => {
                  if (!open) {
                    setStatusConfirm(null);
                  }
                }}
                title={statusConfirm === "deactivate" ? t("deactivateTitle") : t("activateTitle")}
                description={
                  statusConfirm === "deactivate" ? t("deactivateHelp") : t("activateHelp")
                }
                confirmLabel={
                  statusConfirm === "deactivate" ? t("deactivateConfirm") : t("activateConfirm")
                }
                cancelLabel={c("cancel")}
                loading={update.isPending}
                onConfirm={() => void confirmStatusChange()}
              />
            </>
          ) : null}

          {canRequestDiscount ? (
            <RequestDiscountSheet
              open={requestDiscountOpen}
              onOpenChange={setRequestDiscountOpen}
              studentId={studentId}
              studentName={student.data?.fullName}
              onRequested={() => void billing.refetch()}
            />
          ) : null}

          {canManage ? (
            <EnrollmentWizard
              open={wizardOpen}
              onOpenChange={(open) => {
                setWizardOpen(open);
                if (!open) {
                  setResumeDraft(null);
                }
              }}
              classrooms={classrooms.data}
              grades={grades.data}
              academicYears={currentYear.data ? [currentYear.data] : undefined}
              initialDraft={resumeDraft}
              initialStudentId={studentId}
              lockStudent
              studentDisplayName={data.fullName}
              extraInvalidatePaths={(tenant) => [
                `/tenants/${tenant}/students/${studentId}/profile`,
                `/tenants/${tenant}/students`
              ]}
              onSaved={refreshEnrollmentData}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
