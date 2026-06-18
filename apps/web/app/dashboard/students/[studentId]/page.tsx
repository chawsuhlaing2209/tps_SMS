"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ConfirmDialog } from "../../../../components/shared/confirm-dialog";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { DataTable } from "../../../lib/data-table";
import { Field } from "../../../lib/form";
import { HeroMoreActionsMenu, HeroOutlineAction, HeroPrimaryAction } from "../../../lib/hero-more-actions";
import { Icon } from "../../../lib/icon";
import { hasAnyPermission } from "../../../lib/permissions";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { RecordList, RecordListItem, RecordListPanel } from "../../../lib/record-list";
import { getSession } from "../../../lib/session";
import { TablePanelBody, TablePanelHead } from "../../../lib/table-panel";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { zodResolver } from "../../../lib/zod-resolver";
import { EnrollmentWizard } from "../../enrollments/enrollment-wizard";
import { PageHeader } from "../../page-header-context";
import { StudentFamilyPanel } from "../student-family-panel";

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
    guardians: { id: string; fullName: string; phone: string | null };
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
    feeItemName: string;
    effectiveFrom: string;
  }>;
  discounts: Array<{
    id: string;
    ruleName: string;
    status: string;
    reason: string;
  }>;
};

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

export default function StudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;
  const router = useRouter();
  const t = useTranslations("students");
  const e = useTranslations("enrollments");
  const p = useTranslations("people");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["student.manage"]);
  const canViewFinance = hasAnyPermission(permissions, ["finance.manage"]);
  const f = useTranslations("finance");
  const currentYear = useCurrentAcademicYear();

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
  const yearName = (id: string) =>
    id === currentYear.data?.id ? (currentYear.data?.name ?? id) : id;

  const openEnrollmentWizard = (draft: Enrollment | null = null) => {
    setResumeDraft(draft);
    setWizardOpen(true);
  };

  const refreshEnrollmentData = () => {
    void student.refetch();
    void enrollments.refetch();
  };

  const enrollmentColumns: ColumnDef<Enrollment, unknown>[] = [
    { id: "classroom", header: e("classroom"), accessorFn: (row) => classroomName(row.classroomId) },
    { id: "grade", header: e("grade"), accessorFn: (row) => gradeName(row.gradeId) },
    { id: "year", header: e("academicYear"), accessorFn: (row) => yearName(row.academicYearId) },
    {
      id: "status",
      header: e("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <span className={`badge badge--${row.original.status}`}>{row.original.status}</span>
      )
    },
    {
      id: "invoice",
      header: e("invoice"),
      cell: ({ row }) =>
        row.original.invoiceId ? (
          <Link className="row-action" href={`/dashboard/finance/invoices/${row.original.invoiceId}`}>
            {e("viewInvoice")}
          </Link>
        ) : (
          "—"
        )
    },
    {
      id: "actions",
      header: e("actions"),
      enableSorting: false,
      cell: ({ row }) => {
        if (row.original.status === "draft" && !row.original.invoiceId) {
          return (
            <button type="button" className="row-action" onClick={() => openEnrollmentWizard(row.original)}>
              {e("continueEnrollment")}
            </button>
          );
        }
        if (row.original.status === "approved" && !row.original.invoiceId) {
          return (
            <button type="button" className="row-action" onClick={() => openEnrollmentWizard(row.original)}>
              {e("continueEnrollment")}
            </button>
          );
        }
        return null;
      }
    }
  ];

  const heroMeta = useMemo(() => {
    if (!student.data) {
      return "";
    }
    const { profile, admissionNumber } = student.data;
    const bits = [
      `${t("rollLabel")} ${admissionNumber}`,
      profile.gradeName && profile.classroomName
        ? `${profile.gradeName} · ${profile.classroomName}`
        : profile.gradeName ?? profile.classroomName,
      profile.streamLabel ? `${profile.streamLabel} ${t("streamSuffix")}` : null,
      profile.enrolledAt
        ? t("enrolledMeta", { date: formatMonthYear(profile.enrolledAt) ?? profile.enrolledAt })
        : null
    ].filter(Boolean);
    return bits.join(" · ");
  }, [student.data, t]);

  if (student.isLoading) {
    return <p className="muted">{c("loading")}</p>;
  }

  if (student.isError || !student.data) {
    return (
      <div className="page-stack">
        <p className="error-text">{t("notFound")}</p>
        <Link href="/dashboard/people?tab=students">{t("backToPeople")}</Link>
      </div>
    );
  }

  const data = student.data;
  const profile = data.profile;

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
        title={data.fullName}
        breadcrumbs={[
          { label: nav("group_school") },
          { label: p("directoryTitle"), href: "/dashboard/people?tab=students" }
        ]}
        backHref="/dashboard/people?tab=students"
        backLabel={t("backToPeople")}
      />

      <section className="structure-room-banner student-profile-banner">
        <div className="structure-room-banner__main student-profile-banner__main">
          <span className="student-profile-avatar">{studentInitials(data.fullName)}</span>
          <div>
            <h2 className="structure-room-banner__title">{data.fullName}</h2>
            <p className="structure-room-banner__meta">{heroMeta}</p>
            {!canManage ? (
              <span className="student-profile-status-label">
                {t(`status_${data.status}` as "status_enrolled")}
              </span>
            ) : null}
          </div>
        </div>
        <div className="structure-room-banner__actions student-profile-banner__actions">
          {canManage ? (
            <HeroMoreActionsMenu
              label={t("moreActions")}
              items={[
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
          {profile.primaryGuardian?.phone ? (
            <HeroPrimaryAction href={`tel:${profile.primaryGuardian.phone.replace(/\s+/g, "")}`}>
              <Icon name="send" />
              {t("messageGuardian")}
            </HeroPrimaryAction>
          ) : (
            <HeroPrimaryAction href="/dashboard/communication">
              <Icon name="send" />
              {t("messageGuardian")}
            </HeroPrimaryAction>
          )}
          <HeroOutlineAction href="/dashboard/exams">
            <Icon name="grading" />
            {t("reportCard")}
          </HeroOutlineAction>
        </div>
      </section>

      <div className="student-profile-stats">
        <article className="student-profile-stat">
          <span className="student-profile-stat__label">{t("attendanceStat")}</span>
          <strong className="student-profile-stat__value">
            {profile.attendancePercent != null ? `${profile.attendancePercent}%` : "—"}
          </strong>
        </article>
        <article className="student-profile-stat">
          <span className="student-profile-stat__label">{t("termGpaStat")}</span>
          <strong className="student-profile-stat__value">
            {profile.termGpa != null ? profile.termGpa.toFixed(1) : "—"}
          </strong>
        </article>
        <article className="student-profile-stat">
          <span className="student-profile-stat__label">{t("feesStat")}</span>
          <strong
            className={
              profile.feeStatus === "paid_in_full"
                ? "student-profile-stat__value student-profile-stat__value--success"
                : "student-profile-stat__value"
            }
          >
            {t(`feeStatus_${profile.feeStatus}`)}
          </strong>
        </article>
        <article className="student-profile-stat">
          <span className="student-profile-stat__label">{t("guardianStat")}</span>
          {profile.primaryGuardian ? (
            <>
              <strong className="student-profile-stat__value student-profile-stat__value--compact">
                {profile.primaryGuardian.fullName}
              </strong>
              <span className="student-profile-stat__sub">
                {profile.primaryGuardian.phone ?? t("noGuardianPhone")}
              </span>
            </>
          ) : (
            <strong className="student-profile-stat__value">—</strong>
          )}
        </article>
      </div>

      <StudentFamilyPanel
        studentId={studentId}
        familyGroupId={data.familyGroupId}
        hasGuardian={data.guardians.length > 0 || Boolean(profile.primaryGuardian)}
        canManage={canManage}
        onUpdated={() => void student.refetch()}
      />

      <section className="panel student-profile-enrollments">
        <TablePanelHead
          title={t("enrollmentsTitle")}
          onRefresh={refreshEnrollmentData}
          onAdd={canManage ? () => openEnrollmentWizard(null) : undefined}
          addLabel={t("enrollInClassroom")}
        />
        <p className="muted panel-help">{t("enrollmentsHelp")}</p>

        {data.classrooms.length > 0 ? (
          <div className="student-profile-placements">
            <h4>{t("classroomPlacementsTitle")}</h4>
            <ul className="student-profile-placement-list">
              {data.classrooms.map((row) => {
                const active = row.classroom_students.effectiveTo == null;
                return (
                  <li key={`${row.classrooms.id}-${row.classroom_students.effectiveFrom}`}>
                    <Link href={`/dashboard/structure/rooms/${row.classrooms.id}`}>
                      {row.classrooms.name}
                    </Link>
                    <span className={active ? "badge badge--active" : "muted"}>
                      {active
                        ? t("placementActive")
                        : t("placementEnded", {
                            date: new Intl.DateTimeFormat(undefined, {
                              day: "numeric",
                              month: "short",
                              year: "numeric"
                            }).format(new Date(row.classroom_students.effectiveTo!))
                          })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <TablePanelBody
          loading={enrollments.isLoading}
          error={enrollments.isError ? c("somethingWrong") : null}
        >
          {!enrollments.data?.length ? (
            <p className="muted">{t("noEnrollmentsYet")}</p>
          ) : (
            <DataTable columns={enrollmentColumns} data={enrollments.data} />
          )}
        </TablePanelBody>
      </section>

      {canViewFinance ? (
        <section className="panel student-profile-billing">
          <TablePanelHead
            title={f("studentBilling")}
            onRefresh={() => void billing.refetch()}
          />
          <TablePanelBody
            loading={billing.isLoading}
            error={billing.isError ? c("somethingWrong") : null}
          >
            {billing.data ? (
              <>
                <div className="student-profile-stats">
                  <article className="student-profile-stat">
                    <span className="student-profile-stat__label">{f("totalOutstanding")}</span>
                    <strong className="student-profile-stat__value">
                      {billing.data.totalOutstanding.toLocaleString()}
                    </strong>
                  </article>
                  <article className="student-profile-stat">
                    <span className="student-profile-stat__label">{f("totalPaid")}</span>
                    <strong className="student-profile-stat__value">
                      {billing.data.totalPaid.toLocaleString()}
                    </strong>
                  </article>
                </div>

                <h4>{f("invoices")}</h4>
                {!billing.data.invoices.length ? (
                  <p className="muted">{f("noInvoices")}</p>
                ) : (
                  <ul className="student-profile-billing-list">
                    {billing.data.invoices.map((invoice) => (
                      <li key={invoice.id}>
                        <Link href={`/dashboard/finance/invoices/${invoice.id}`}>
                          {invoice.invoiceNumber}
                        </Link>
                        <span className="muted">
                          {f(`source_${invoice.source}`)} · {invoice.total} · {invoice.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <h4>{f("activeServices")}</h4>
                {!billing.data.activeServices.length ? (
                  <p className="muted">{f("noActiveServices")}</p>
                ) : (
                  <ul className="student-profile-billing-list">
                    {billing.data.activeServices.map((service) => (
                      <li key={service.id}>
                        {service.feeItemName}
                        <span className="muted">{service.effectiveFrom}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <h4>{f("billingDiscounts")}</h4>
                {!billing.data.discounts.length ? (
                  <p className="muted">{f("noDiscounts")}</p>
                ) : (
                  <ul className="student-profile-billing-list">
                    {billing.data.discounts.map((discount) => (
                      <li key={discount.id}>
                        {discount.ruleName}
                        <span className="muted">
                          {discount.status} · {discount.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}
          </TablePanelBody>
        </section>
      ) : null}

      <RecordListPanel
        title={t("subjectsThisTerm")}
        empty={!profile.subjects.length ? t("noSubjectsThisTerm") : undefined}
      >
        {profile.subjects.length ? (
          <RecordList>
            {profile.subjects.map((subject) => (
              <RecordListItem
                key={subject.id}
                nameForColor={subject.name}
                title={subject.name}
                meta={subject.code ?? undefined}
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
                <button type="button" className="btn-ghost" onClick={() => setEditOpen(false)}>
                  {c("cancel")}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={update.isPending || updateGuardian.isPending || createGuardian.isPending}
                >
                  <Icon name="check" />
                  {update.isPending ? c("loading") : c("save")}
                </button>
              </>
            }
          >
            <Field label={t("firstName")} error={editForm.formState.errors.firstName?.message}>
              <input {...editForm.register("firstName")} />
            </Field>
            <Field label={t("lastName")} error={editForm.formState.errors.lastName?.message}>
              <input {...editForm.register("lastName")} />
            </Field>
            <Field label={t("address")}>
              <input {...editForm.register("address")} />
            </Field>
            <Field label={t("medicalNotes")}>
              <textarea {...editForm.register("medicalNotes")} rows={3} />
            </Field>
            <div className="student-profile-edit-divider">
              <h4>{t("guardianContactTitle")}</h4>
              <p className="muted">{t("guardianContactHelp")}</p>
            </div>
            <Field label={t("guardianFirstName")}>
              <input {...editForm.register("guardianFirstName")} />
            </Field>
            <Field label={t("guardianLastName")}>
              <input {...editForm.register("guardianLastName")} />
            </Field>
            <Field label={t("guardianPhone")}>
              <input {...editForm.register("guardianPhone")} />
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
            confirmLabel={statusConfirm === "deactivate" ? t("deactivateConfirm") : t("activateConfirm")}
            cancelLabel={c("cancel")}
            loading={update.isPending}
            onConfirm={() => void confirmStatusChange()}
          />
        </>
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
    </div>
  );
}
