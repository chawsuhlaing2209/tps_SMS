"use client";

import { updateTeacherTeachingSetupSchema } from "@sms/shared";
import { cn } from "../../../../lib/utils";
import { StatusPill } from "../../../../components/pds/subcomponents/status-pill";
import { StatusBadge, Badge } from "../../../../components/shared/badge";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { NavigationBackLink } from "../../../../components/shared/navigation-back-link";
import { TrailLink } from "../../../../components/shared/trail-link";
import { useEffect, useMemo, useState, use } from "react";
import { DetailCard } from "../../../../components/pds";
import { SegmentedControl } from "../../../../components/pds/composites/segmented-control";
import { Button } from "../../../../components/ui/button";
import { ConfirmDialog } from "../../../../components/shared/confirm-dialog";
import { RowMoreActionsMenu } from "../../../../components/shared/row-more-actions";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { HeroMoreActionsMenu, HeroPrimaryAction } from "../../../lib/hero-more-actions";
import { Icon } from "../../../lib/material-icon";
import { hasAnyPermission } from "../../../lib/permissions";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { getSession } from "../../../lib/session";
import { PageHeader } from "../../page-header-context";
import { TeacherEditSheet } from "../teacher-edit-sheet";
import {
  chiefConflicts,
  draftToTeachingSetup,
  emptyTeachingSetupDraft,
  homeroomConflicts,
  TeacherClassroomsSetupFields,
  TeacherGradesSetupFields,
  TeacherSubjectsSetupFields,
  teachingSetupToDraft,
  type TeachingSetupDraft,
  type TeachingSetupOptions
} from "../teacher-teaching-setup";
import styles from "../teacher-profile.module.css";
import { subjectColor } from "../../structure/subject-colors";
import "../teacher-teaching-setup-modal.css";
import { StaffCompensationSection } from "../../salary/staff-compensation-section";

type TeacherProfile = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  departmentId: string | null;
  employeeNumber: string | null;
  joinDate: string | null;
  promotionTitle: string | null;
  status: string;
  archivedAt: string | null;
  loginEmail: string | null;
  yearsExperience: number | null;
  qualifications: Array<{ title?: string; institution?: string; year?: string }>;
  capability: {
    sectorIds: string[];
    competentSubjectIds: string[];
    eligibleGradeIds: string[];
  };
  assignments: {
    gradeChief: Array<{ gradeName: string; academicYearName: string; gradeId: string }>;
    homeroom: Array<{
      classroomName: string;
      gradeName: string;
      gradeId: string;
      room: string | null;
      classroomId: string;
    }>;
    subjectTeaching: Array<{
      classroomName: string;
      subjectName: string;
      subjectCode: string | null;
      classroomId: string;
      subjectId: string;
      gradeId: string;
      gradeName: string;
    }>;
  };
  stats: {
    periodsPerWeek: number;
    classesTaught: number;
    students: number;
    avgClassScore: number | null;
  };
};

type AssignmentRow = {
  classroomId: string;
  classroomName: string;
  subjectName: string;
  room: string | null;
  gradeName: string;
};

type AssignedGradeRow = {
  gradeId: string;
  gradeName: string;
  academicYearName?: string;
  isGradeChief: boolean;
};

function aggregateAssignedGrades(teacher: TeacherProfile): AssignedGradeRow[] {
  const byGrade = new Map<string, AssignedGradeRow>();

  for (const row of teacher.assignments.gradeChief) {
    byGrade.set(row.gradeId, {
      gradeId: row.gradeId,
      gradeName: row.gradeName,
      academicYearName: row.academicYearName,
      isGradeChief: true
    });
  }

  for (const row of teacher.assignments.homeroom) {
    if (byGrade.has(row.gradeId)) {
      continue;
    }
    byGrade.set(row.gradeId, {
      gradeId: row.gradeId,
      gradeName: row.gradeName,
      isGradeChief: false
    });
  }

  for (const row of teacher.assignments.subjectTeaching) {
    if (byGrade.has(row.gradeId)) {
      continue;
    }
    byGrade.set(row.gradeId, {
      gradeId: row.gradeId,
      gradeName: row.gradeName,
      isGradeChief: false
    });
  }

  return [...byGrade.values()].sort((left, right) => left.gradeName.localeCompare(right.gradeName));
}

type ProfileTab = "overview" | "teaching" | "salary";

function subjectIconName(subject: string): string {
  const name = subject.toLowerCase();
  if (name.includes("math")) return "calculate";
  if (name.includes("english")) return "menu_book";
  if (name.includes("physics")) return "science";
  if (name.includes("chem")) return "biotech";
  return "school";
}

function classroomBadgeLabel(classroomName: string): string {
  const trimmed = classroomName.trim();
  const segment = trimmed.split(/[\s·-]+/).pop() ?? trimmed;
  return segment.charAt(0).toUpperCase();
}

function formatProfileDate(value: string | null) {
  if (!value) {
    return "—";
  }
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function teacherStatusLabel(
  status: string,
  t: (key: "statusActive" | "statusInactive" | "statusProbation" | "statusResigned" | "statusTerminated" | "statusArchived") => string
) {
  switch (status) {
    case "active":
      return t("statusActive");
    case "probation":
      return t("statusProbation");
    case "resigned":
      return t("statusResigned");
    case "terminated":
      return t("statusTerminated");
    case "archived":
      return t("statusArchived");
    default:
      return t("statusInactive");
  }
}

function buildHeroMeta(
  teacher: TeacherProfile,
  subjectNames: string[],
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  const parts: string[] = [];
  if (teacher.promotionTitle) {
    parts.push(teacher.promotionTitle);
  } else if (teacher.assignments.gradeChief[0]?.gradeName) {
    parts.push(`${teacher.assignments.gradeChief[0]!.gradeName} ${t("gradeChiefBadge")}`);
  }
  if (subjectNames.length) {
    parts.push(subjectNames.slice(0, 4).join(" & "));
  }
  if (teacher.department) {
    parts.push(teacher.department);
  }
  if (teacher.yearsExperience != null) {
    parts.push(t("yearsExperience", { count: teacher.yearsExperience }));
  }
  return parts.join(" · ");
}

const profilePath = (tenant: string, teacherId: string) =>
  `/tenants/${tenant}/hr/staff/${teacherId}/teacher-profile`;
const optionsPath = (tenant: string) => `/tenants/${tenant}/hr/teacher-assignment-options`;
const teachingSetupPath = (tenant: string, teacherId: string) =>
  `/tenants/${tenant}/hr/staff/${teacherId}/teaching-setup`;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const DEMO_TODAY_CLASSES = [
  { time: "08:30", title: "Physics · Room 11-A", subtitleKey: "schedulePeriod", subtitleArgs: { period: 1 }, tone: "purple" as const },
  { time: "10:15", title: "Physics · Room 11-B", subtitleKey: "schedulePeriod", subtitleArgs: { period: 3 }, tone: "purple" as const },
  {
    time: "13:00",
    title: "Grade 11 grade chiefs meeting",
    subtitle: "Physics team · Staff room",
    tone: "mustard" as const
  }
];

const DEMO_TO_GRADE = [
  { title: "Physics — Week 6 assessment", meta: { room: "Room 11-A", due: "20 Jun" }, count: 3, tone: "purple" as const },
  { title: "Physics — Week 6 lab report", meta: { room: "Room 11-B", due: "21 Jun" }, count: 4, tone: "purple" as const },
  { title: "Chemistry — Midterm scripts", meta: { room: "Room 10-A", due: "22 Jun" }, count: 5, tone: "pink" as const }
];

type TaughtSubjectRow = {
  subjectId: string;
  subjectName: string;
  classroomCount: number;
};

function aggregateTaughtSubjects(
  teacher: TeacherProfile,
  options: TeachingSetupOptions | undefined
): TaughtSubjectRow[] {
  const assignmentCounts = new Map<string, number>();
  for (const row of teacher.assignments.subjectTeaching) {
    assignmentCounts.set(row.subjectId, (assignmentCounts.get(row.subjectId) ?? 0) + 1);
  }

  const subjectById = new Map(
    (options?.subjects ?? []).map((subject) => [subject.id, subject])
  );
  for (const row of teacher.assignments.subjectTeaching) {
    if (!subjectById.has(row.subjectId)) {
      subjectById.set(row.subjectId, {
        id: row.subjectId,
        name: row.subjectName,
        code: row.subjectCode
      });
    }
  }

  return teacher.capability.competentSubjectIds
    .map((subjectId) => {
      const subject = subjectById.get(subjectId);
      return {
        subjectId,
        subjectName: subject?.name ?? subjectId,
        classroomCount: assignmentCounts.get(subjectId) ?? 0
      };
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
}

function flattenAssignments(teacher: TeacherProfile): AssignmentRow[] {
  const rows = new Map<string, AssignmentRow>();

  for (const row of teacher.assignments.subjectTeaching) {
    rows.set(row.classroomId, {
      classroomId: row.classroomId,
      classroomName: row.classroomName,
      subjectName: row.subjectName,
      room: null,
      gradeName: row.gradeName
    });
  }

  for (const row of teacher.assignments.homeroom) {
    const existing = rows.get(row.classroomId);
    if (existing) {
      existing.room = row.room;
      continue;
    }
    rows.set(row.classroomId, {
      classroomId: row.classroomId,
      classroomName: row.classroomName,
      subjectName: "—",
      room: row.room,
      gradeName: row.gradeName
    });
  }

  return [...rows.values()];
}

type TeachingSetupModal = "subjects" | "grades" | "classrooms" | null;

export default function TeacherProfilePage({
  params
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const t = useTranslations("teachers");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const { teacherId } = use(params);
  const permissions = getSession()?.permissions;
  const canManageHr = hasAnyPermission(permissions, ["hr.manage"]);
  const canViewTeacher = canManageHr || hasAnyPermission(permissions, ["classroom.manage"]);

  const [editOpen, setEditOpen] = useState(false);
  const [setupModal, setSetupModal] = useState<TeachingSetupModal>(null);
  const [confirmSaveKind, setConfirmSaveKind] = useState<"grades" | "classrooms" | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<"deactivate" | "activate" | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [deleteForeverOpen, setDeleteForeverOpen] = useState(false);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [draft, setDraft] = useState<TeachingSetupDraft>(emptyTeachingSetupDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [removingSubjectId, setRemovingSubjectId] = useState<string | null>(null);

  const profile = useApiQuery<TeacherProfile>((tenant) => profilePath(tenant, teacherId));
  const options = useApiQuery<TeachingSetupOptions>((tenant) =>
    canViewTeacher ? optionsPath(tenant) : null
  );
  const existingSetup = useApiQuery<{
    capability: TeacherProfile["capability"];
    assignments: {
      gradeChief: { academicYearId: string; gradeId: string }[];
      homeroom: { classroomId: string }[];
      subjectTeaching: { classroomId: string; subjectId: string; gradeId?: string }[];
    };
  }>((tenant) => (canManageHr ? teachingSetupPath(tenant, teacherId) : null));

  const updateTeachingSetup = useApiMutation(
    (body: unknown, tenant) => ({
      path: teachingSetupPath(tenant, teacherId),
      init: { method: "PUT", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        profilePath(tenant, teacherId),
        teachingSetupPath(tenant, teacherId)
      ]
    }
  );

  const updateStaffStatus = useApiMutation(
    (body: { employmentStatus: string }, tenant) => ({
      path: `/tenants/${tenant}/hr/staff/${teacherId}/provision`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        profilePath(tenant, teacherId),
        `/tenants/${tenant}/hr/staff/overview?employmentRole=teacher`
      ]
    }
  );

  const archiveTeacher = useApiMutation<Record<string, never>>(
    (_body, tenant) => ({
      path: `/tenants/${tenant}/hr/staff/${teacherId}/archive`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [profilePath(tenant, teacherId)] }
  );

  const restoreTeacher = useApiMutation<Record<string, never>>(
    (_body, tenant) => ({
      path: `/tenants/${tenant}/hr/staff/${teacherId}/restore`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [profilePath(tenant, teacherId)] }
  );

  const deleteTeacher = useApiMutation<Record<string, never>>(
    (_body, tenant) => ({
      path: `/tenants/${tenant}/hr/staff/${teacherId}`,
      init: { method: "DELETE" }
    })
  );

  useEffect(() => {
    if (!setupModal || !existingSetup.data) {
      return;
    }
    setDraft(teachingSetupToDraft(existingSetup.data, options.data));
  }, [setupModal, existingSetup.data, options.data]);

  const assignmentRows = useMemo(
    () => (profile.data ? flattenAssignments(profile.data) : []),
    [profile.data]
  );

  const taughtSubjects = useMemo(
    () => (profile.data ? aggregateTaughtSubjects(profile.data, options.data) : []),
    [profile.data, options.data]
  );

  const assignmentSummary = useMemo(() => {
    if (!profile.data) return "";
    const subjects = new Set(
      profile.data.assignments.subjectTeaching.map((row) => row.subjectName)
    );
    return t("assignmentSummary", {
      classrooms: assignmentRows.length,
      subjects: subjects.size
    });
  }, [assignmentRows.length, profile.data, t]);

  const metaLine = useMemo(() => {
    if (!profile.data) return "";
    const subjectNames = aggregateTaughtSubjects(profile.data, options.data).map(
      (row) => row.subjectName
    );
    return buildHeroMeta(profile.data, subjectNames, t);
  }, [profile.data, options.data, t]);

  const tabOptions = useMemo(
    () => [
      { id: "overview", label: t("tabOverview") },
      { id: "teaching", label: t("tabTeachingAssignments") },
      ...(canManageHr ? [{ id: "salary", label: t("tabSalaryCompensation") }] : [])
    ],
    [canManageHr, t]
  );

  useEffect(() => {
    if (activeTab === "salary" && !canManageHr) {
      setActiveTab("overview");
    }
  }, [activeTab, canManageHr]);

  const chiefConflictRows = chiefConflicts(draft, options.data, teacherId);
  const homeroomConflictRows = homeroomConflicts(draft, options.data, teacherId);
  const setupFieldsLoading = options.isLoading || existingSetup.isLoading;

  async function saveTeachingSetup(kind: "subjects" | "grades" | "classrooms", skipConfirm = false) {
    setFormError(null);
    if (!skipConfirm && kind === "grades" && chiefConflictRows.length > 0) {
      setConfirmSaveKind("grades");
      return;
    }
    if (!skipConfirm && kind === "classrooms" && homeroomConflictRows.length > 0) {
      setConfirmSaveKind("classrooms");
      return;
    }

    const parsed = updateTeacherTeachingSetupSchema.safeParse(
      draftToTeachingSetup(draft, options.data)
    );
    if (!parsed.success) {
      setFormError(c("somethingWrong"));
      return;
    }
    try {
      await updateTeachingSetup.mutateAsync(parsed.data);
      setConfirmSaveKind(null);
      setSetupModal(null);
      void profile.refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : c("somethingWrong"));
    }
  }

  async function removeTaughtSubject(subjectId: string) {
    if (!existingSetup.data) {
      return;
    }
    setRemovingSubjectId(subjectId);
    setFormError(null);
    try {
      const nextDraft = teachingSetupToDraft(existingSetup.data, options.data);
      nextDraft.competentSubjectIds = nextDraft.competentSubjectIds.filter(
        (id) => id !== subjectId
      );
      nextDraft.classroomRows = nextDraft.classroomRows.filter((row) => row.subjectId !== subjectId);
      const parsed = updateTeacherTeachingSetupSchema.safeParse(
        draftToTeachingSetup(nextDraft, options.data)
      );
      if (!parsed.success) {
        setFormError(c("somethingWrong"));
        return;
      }
      await updateTeachingSetup.mutateAsync(parsed.data);
      void profile.refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : c("somethingWrong"));
    } finally {
      setRemovingSubjectId(null);
    }
  }

  function openSetupModal(kind: TeachingSetupModal) {
    setFormError(null);
    if (existingSetup.data) {
      setDraft(teachingSetupToDraft(existingSetup.data, options.data));
    }
    setSetupModal(kind);
  }

  async function confirmStatusChange() {
    if (!statusConfirm) {
      return;
    }
    await updateStaffStatus.mutateAsync({
      employmentStatus: statusConfirm === "activate" ? "active" : "archived"
    });
    setStatusConfirm(null);
    void profile.refetch();
  }

  async function handleArchive() {
    await archiveTeacher.mutateAsync({});
    setArchiveOpen(false);
    void profile.refetch();
  }

  async function handleRestore() {
    await restoreTeacher.mutateAsync({});
    setRestoreOpen(false);
    void profile.refetch();
  }

  async function handlePermanentDelete() {
    // A blocking-dependency 409 surfaces its message via the shared error toast.
    await deleteTeacher.mutateAsync({});
    setDeleteForeverOpen(false);
    router.push("/dashboard/teachers");
  }

  if (profile.isLoading) {
    return <p className="pds-type-body-s-regular muted">{c("loading")}</p>;
  }

  if (profile.isError || !profile.data) {
    return <p className="pds-type-body-m-medium error-text">{c("somethingWrong")}</p>;
  }

  const teacher = profile.data;
  const isTeacherActive = teacher.status === "active" || teacher.status === "probation";
  const teacherHref = `/dashboard/teachers/${teacherId}`;
  const qualificationTags = teacher.qualifications.map((item, index) => ({
    id: `${item.title}-${index}`,
    label: `${item.title}${item.institution ? ` — ${item.institution}` : ""}`,
    icon: "workspace_premium" as const
  }));
  const assignedGrades = aggregateAssignedGrades(teacher);

  return (
    <div className={styles.teacherProfilePage}>
      <PageHeader
        title={t("profileTitle")}
        segment={{ label: teacher.fullName, href: teacherHref }}
        breadcrumbs={[
          { label: nav("group_school") },
          { label: nav("teachers"), href: "/dashboard/teachers" },
          { label: teacher.fullName }
        ]}
      />

      <NavigationBackLink fallback={{ label: nav("teachers"), href: "/dashboard/teachers" }} />

      <DetailCard
        className={styles.teacherProfileDetailCard}
        avatar={{ initials: initials(teacher.fullName), tone: "custom", background: subjectColor(teacher.fullName).bg }}
        title={teacher.fullName}
        status={
          <StatusPill tone={isTeacherActive ? "active" : "inactive"}>
            {isTeacherActive ? t("statusActive") : t("statusInactive")}
          </StatusPill>
        }
        meta={metaLine || undefined}
        tags={qualificationTags.length ? qualificationTags : undefined}
        actions={
          canManageHr ? (
            <>
              <HeroMoreActionsMenu
                label={t("moreActions")}
                items={[
                  {
                    id: "status",
                    label: isTeacherActive ? t("setAsInactive") : t("markActive"),
                    icon: isTeacherActive ? "pause_circle" : "check_circle",
                    onSelect: () => setStatusConfirm(isTeacherActive ? "deactivate" : "activate")
                  },
                  ...(teacher.email
                    ? [
                        {
                          id: "email",
                          label: t("email"),
                          icon: "mail",
                          onSelect: () => {
                            window.location.href = `mailto:${teacher.email}`;
                          }
                        }
                      ]
                    : []),
                  ...(teacher.archivedAt
                    ? [
                        {
                          id: "restore",
                          label: c("restore"),
                          icon: "restore",
                          onSelect: () => setRestoreOpen(true)
                        },
                        {
                          id: "deleteForever",
                          label: c("deletePermanently"),
                          icon: "delete_forever",
                          destructive: true,
                          onSelect: () => setDeleteForeverOpen(true)
                        }
                      ]
                    : [
                        {
                          id: "archive",
                          label: c("archive"),
                          icon: "archive",
                          destructive: true,
                          onSelect: () => setArchiveOpen(true)
                        }
                      ])
                ]}
              />
              <HeroPrimaryAction onClick={() => setEditOpen(true)}>
                <Icon name="edit" size={18} />
                {t("editTeacher")}
              </HeroPrimaryAction>
            </>
          ) : null
        }
      />

      <div className={styles.teacherProfileStats}>
          <article className={styles.teacherProfileStatCard}>
            <span className={`${styles.teacherProfileStatIcon} ${styles.teacherProfileStatIconBlue}`}>
              <Icon name="schedule" size={19} />
            </span>
            <strong className={cn("pds-type-title-l-extrabold", styles.teacherProfileStatValue)}>{teacher.stats.periodsPerWeek || "—"}</strong>
            <span className={cn("pds-type-body-s-regular", styles.teacherProfileStatLabel)}>{t("statPeriods")}</span>
          </article>
          <article className={styles.teacherProfileStatCard}>
            <span className={`${styles.teacherProfileStatIcon} ${styles.teacherProfileStatIconPurple}`}>
              <Icon name="meeting_room" size={19} />
            </span>
            <strong className={cn("pds-type-title-l-extrabold", styles.teacherProfileStatValue)}>{teacher.stats.classesTaught}</strong>
            <span className={cn("pds-type-body-s-regular", styles.teacherProfileStatLabel)}>{t("statClasses")}</span>
          </article>
          <article className={styles.teacherProfileStatCard}>
            <span className={`${styles.teacherProfileStatIcon} ${styles.teacherProfileStatIconOrange}`}>
              <Icon name="groups" size={19} />
            </span>
            <strong className={cn("pds-type-title-l-extrabold", styles.teacherProfileStatValue)}>{teacher.stats.students}</strong>
            <span className={cn("pds-type-body-s-regular", styles.teacherProfileStatLabel)}>{t("statStudents")}</span>
          </article>
          <article className={styles.teacherProfileStatCard}>
            <span className={`${styles.teacherProfileStatIcon} ${styles.teacherProfileStatIconGreen}`}>
              <Icon name="trending_up" size={19} />
            </span>
            <strong className={cn("pds-type-title-l-extrabold", styles.teacherProfileStatValue)}>
              {teacher.stats.avgClassScore != null ? `${teacher.stats.avgClassScore}%` : "—"}
            </strong>
          <span className={cn("pds-type-body-s-regular", styles.teacherProfileStatLabel)}>{t("statAvgScore")}</span>
        </article>
      </div>

      <SegmentedControl
        className={styles.teacherProfileTabs}
        ariaLabel={t("profileTabsAria")}
        options={tabOptions}
        value={activeTab}
        onChange={(id) => setActiveTab(id as ProfileTab)}
      />

      {activeTab === "overview" ? (
        <>
          <section className={cn(styles.teacherProfileCard, styles.teacherProfileCardCompact)}>
            <div className={styles.teacherProfileCardHead}>
              <h2 className={cn("pds-type-title-xs-bold", styles.teacherProfileCardTitle)}>
                {t("profileSummaryTitle")}
              </h2>
            </div>
            <dl className={styles.teacherProfileSummaryGrid}>
              <div className={styles.teacherProfileSummaryItem}>
                <dt className={cn("pds-type-body-s-regular", styles.teacherProfileSummaryLabel)}>
                  {t("email")}
                </dt>
                <dd className={cn("pds-type-body-m-medium", styles.teacherProfileSummaryValue)}>
                  {teacher.email ?? "—"}
                </dd>
              </div>
              <div className={styles.teacherProfileSummaryItem}>
                <dt className={cn("pds-type-body-s-regular", styles.teacherProfileSummaryLabel)}>
                  {t("phone")}
                </dt>
                <dd className={cn("pds-type-body-m-medium", styles.teacherProfileSummaryValue)}>
                  {teacher.phone ?? "—"}
                </dd>
              </div>
              <div className={styles.teacherProfileSummaryItem}>
                <dt className={cn("pds-type-body-s-regular", styles.teacherProfileSummaryLabel)}>
                  {t("department")}
                </dt>
                <dd className={cn("pds-type-body-m-medium", styles.teacherProfileSummaryValue)}>
                  {teacher.department ?? "—"}
                </dd>
              </div>
              <div className={styles.teacherProfileSummaryItem}>
                <dt className={cn("pds-type-body-s-regular", styles.teacherProfileSummaryLabel)}>
                  {t("joinDate")}
                </dt>
                <dd className={cn("pds-type-body-m-medium", styles.teacherProfileSummaryValue)}>
                  {formatProfileDate(teacher.joinDate)}
                </dd>
              </div>
              <div className={styles.teacherProfileSummaryItem}>
                <dt className={cn("pds-type-body-s-regular", styles.teacherProfileSummaryLabel)}>
                  {t("summaryStaffId")}
                </dt>
                <dd className={cn("pds-type-body-m-medium", styles.teacherProfileSummaryValue)}>
                  {teacher.employeeNumber ?? "—"}
                </dd>
              </div>
              <div className={styles.teacherProfileSummaryItem}>
                <dt className={cn("pds-type-body-s-regular", styles.teacherProfileSummaryLabel)}>
                  {t("summaryLoginAccount")}
                </dt>
                <dd className={cn("pds-type-body-m-medium", styles.teacherProfileSummaryValue)}>
                  {teacher.loginEmail ?? t("loginNone")}
                </dd>
              </div>
              <div className={styles.teacherProfileSummaryItem}>
                <dt className={cn("pds-type-body-s-regular", styles.teacherProfileSummaryLabel)}>
                  {t("promotionTitle")}
                </dt>
                <dd className={cn("pds-type-body-m-medium", styles.teacherProfileSummaryValue)}>
                  {teacher.promotionTitle ?? "—"}
                </dd>
              </div>
              <div className={styles.teacherProfileSummaryItem}>
                <dt className={cn("pds-type-body-s-regular", styles.teacherProfileSummaryLabel)}>
                  {c("status")}
                </dt>
                <dd className={styles.teacherProfileSummaryValue}>
                  <StatusBadge
                    status={teacher.status}
                    label={teacherStatusLabel(teacher.status, t)}
                  />
                </dd>
              </div>
              <div className={styles.teacherProfileSummaryItem}>
                <dt className={cn("pds-type-body-s-regular", styles.teacherProfileSummaryLabel)}>
                  {t("summaryExperience")}
                </dt>
                <dd className={cn("pds-type-body-m-medium", styles.teacherProfileSummaryValue)}>
                  {teacher.yearsExperience != null
                    ? t("yearsExperience", { count: teacher.yearsExperience })
                    : "—"}
                </dd>
              </div>
              <div className={styles.teacherProfileSummaryItem}>
                <dt className={cn("pds-type-body-s-regular", styles.teacherProfileSummaryLabel)}>
                  {t("qualificationsTitle")}
                </dt>
                <dd className={cn("pds-type-body-m-medium", styles.teacherProfileSummaryValue)}>
                  {teacher.qualifications.length
                    ? t("summaryCredentialsCount", { count: teacher.qualifications.length })
                    : "—"}
                </dd>
              </div>
            </dl>
          </section>

          <div className={styles.teacherProfileTabGrid}>
          <section className={styles.teacherProfileCard}>
            <div className={styles.teacherProfileCardHead}>
              <div>
                <h2 className={cn("pds-type-title-xs-bold", styles.teacherProfileCardTitle)}>{t("todaysClasses")}</h2>
                <p className={cn("pds-type-body-s-regular", styles.teacherProfileCardSubtitle)}>
                  {t("classesSummary", { count: DEMO_TODAY_CLASSES.length })}
                </p>
              </div>
            </div>
            <ul className={styles.teacherProfileRowList}>
              {DEMO_TODAY_CLASSES.map((item) => (
                <li key={item.time} className={styles.teacherProfileScheduleRow}>
                  <span className={cn("pds-type-body-s-semibold", styles.teacherProfileScheduleTime)}>{item.time}</span>
                  <span
                    className={cn(
                      styles.teacherProfileScheduleMark,
                      item.tone === "mustard"
                        ? styles.teacherProfileScheduleMarkMustard
                        : styles.teacherProfileScheduleMarkPurple
                    )}
                  />
                  <div className={styles.teacherProfileRowBody}>
                    <span className={cn("pds-type-body-m-bold", styles.teacherProfileRowTitle)}>{item.title}</span>
                    <span className={cn("pds-type-body-s-regular", styles.teacherProfileRowMeta)}>
                      {"subtitle" in item
                        ? item.subtitle
                        : t(item.subtitleKey!, item.subtitleArgs!)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className={styles.teacherProfileStack}>
            <section className={styles.teacherProfileCard}>
              <div className={styles.teacherProfileCardHead}>
                <div>
                  <h2 className={cn("pds-type-title-xs-bold", styles.teacherProfileCardTitle)}>{t("toGrade")}</h2>
                  <p className={cn("pds-type-body-s-regular", styles.teacherProfileCardSubtitle)}>
                    {t("assessmentsSummary", { count: DEMO_TO_GRADE.length })}
                  </p>
                </div>
                <span className={cn("pds-type-label-s-medium", styles.teacherProfileActionBadge)}>
                  {t("actionNeeded")}
                </span>
              </div>
              <ul className={styles.teacherProfileRowList}>
                {DEMO_TO_GRADE.map((item) => (
                  <li key={item.title} className={styles.teacherProfileGradeRow}>
                    <span
                      className={cn(
                        styles.teacherProfileGradeIcon,
                        item.tone === "pink"
                          ? styles.teacherProfileSubjectPink
                          : styles.teacherProfileSubjectPurple
                      )}
                    >
                      <Icon name="grading" size={18} />
                    </span>
                    <div className={styles.teacherProfileRowBody}>
                      <span className={cn("pds-type-body-m-bold", styles.teacherProfileRowTitle)}>{item.title}</span>
                      <span className={cn("pds-type-body-s-regular", styles.teacherProfileRowMeta)}>
                        {t("gradeAssessmentMeta", item.meta)}
                      </span>
                    </div>
                    <span className={cn("pds-type-body-m-bold", styles.teacherProfileGradeCount)}>{item.count}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className={cn(styles.teacherProfileCard, styles.teacherProfileDarkCard)}>
              <div className={styles.teacherProfileDarkStat}>
                <strong className={cn("pds-type-title-xl-extrabold", styles.teacherProfileDarkStatValueAccent)}>
                  96%
                </strong>
                <span className={cn("pds-type-body-s-regular", styles.teacherProfileDarkStatLabel)}>
                  {t("registersOnTime")}
                </span>
              </div>
              <div className={styles.teacherProfileDarkCardDivider} aria-hidden />
              <div className={styles.teacherProfileDarkStat}>
                <strong className={cn("pds-type-title-xl-extrabold", styles.teacherProfileDarkStatValue)}>14</strong>
                <span className={cn("pds-type-body-s-regular", styles.teacherProfileDarkStatLabel)}>
                  {t("leaveDaysLeft")}
                </span>
              </div>
            </section>
          </div>
        </div>
        </>
      ) : null}

      {activeTab === "teaching" ? (
        <div className={styles.teacherProfileTabGrid}>
          <div className={styles.teacherProfileStack}>
            <section className={styles.teacherProfileCard}>
              <div className={styles.teacherProfileCardHead}>
                <div>
                  <h2 className={cn("pds-type-title-xs-bold", styles.teacherProfileCardTitle)}>
                    {t("subjectsAndLanguagesTaught")}
                  </h2>
                  {taughtSubjects.length ? (
                    <p className={cn("pds-type-body-s-regular", styles.teacherProfileCardSubtitle)}>
                      {t("taughtSubjectSummary", { count: taughtSubjects.length })}
                    </p>
                  ) : null}
                </div>
                {canManageHr ? (
                  <Button
                    type="button"
                    buttonType="filled"
                    buttonColor="secondary"
                    prefixIcon="add"
                    onClick={() => openSetupModal("subjects")}
                  >
                    {t("addSubjectCompetency")}
                  </Button>
                ) : null}
              </div>

              {taughtSubjects.length === 0 ? (
                <p className={cn("pds-type-body-s-regular", styles.teacherProfileEmpty)}>{t("noTaughtSubjects")}</p>
              ) : (
                <ul className={styles.teacherProfileSubjectList}>
                  {taughtSubjects.map((row) => (
                    <li key={row.subjectId} className={styles.teacherProfileSubjectRow}>
                      <span className={styles.teacherProfileSubjectIcon} aria-hidden>
                        <Icon name={subjectIconName(row.subjectName)} size={18} />
                      </span>
                      <span className={cn("pds-type-body-m-bold", styles.teacherProfileSubjectName)}>
                        {row.subjectName}
                      </span>
                      {canManageHr ? (
                        <RowMoreActionsMenu
                          ariaLabel={c("moreActions")}
                          items={[
                            {
                              id: "edit",
                              label: c("edit"),
                              icon: "edit",
                              onSelect: () => openSetupModal("subjects")
                            },
                            {
                              id: "remove",
                              label: c("remove"),
                              icon: "delete",
                              destructive: true,
                              disabled: removingSubjectId === row.subjectId || updateTeachingSetup.isPending,
                              onSelect: () => void removeTaughtSubject(row.subjectId)
                            }
                          ]}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {formError && !setupModal ? (
                <p className="pds-type-body-m-medium error-text">{formError}</p>
              ) : null}
            </section>

            <section className={styles.teacherProfileCard}>
              <div className={styles.teacherProfileCardHead}>
                <div>
                  <h2 className={cn("pds-type-title-xs-bold", styles.teacherProfileCardTitle)}>
                    {t("teachingAssignments")}
                  </h2>
                  {assignmentRows.length ? (
                    <p className={cn("pds-type-body-s-regular", styles.teacherProfileCardSubtitle)}>
                      {assignmentSummary}
                    </p>
                  ) : null}
                </div>
                {canManageHr ? (
                  <button
                    type="button"
                    className={cn("pds-type-body-m-medium", styles.teacherProfileManageBtn)}
                    onClick={() => openSetupModal("classrooms")}
                  >
                    <Icon name="edit" size={18} />
                    {t("manageClassrooms")}
                  </button>
                ) : null}
              </div>
              {assignmentRows.length === 0 ? (
                <p className={cn("pds-type-body-s-regular", styles.teacherProfileEmpty)}>{t("noAssignments")}</p>
              ) : (
                <ul className={styles.teacherProfileRowList}>
                  {assignmentRows.map((row) => (
                    <li key={row.classroomId} className={styles.teacherProfileAssignmentRow}>
                      <span className={styles.teacherProfileClassBadge} aria-hidden>
                        {classroomBadgeLabel(row.classroomName)}
                      </span>
                      <div className={styles.teacherProfileRowBody}>
                        <span className={cn("pds-type-body-m-bold", styles.teacherProfileRowTitle)}>
                          {row.gradeName} · {row.classroomName}
                        </span>
                        <span className={cn("pds-type-body-s-regular", styles.teacherProfileRowMeta)}>
                          {t("assignmentRowMeta", {
                            students: teacher.stats.students || "—",
                            periods: teacher.stats.periodsPerWeek || "—"
                          })}
                        </span>
                      </div>
                      {canManageHr ? (
                        <RowMoreActionsMenu
                          ariaLabel={c("moreActions")}
                          items={[
                            {
                              id: "edit",
                              label: c("edit"),
                              icon: "edit",
                              onSelect: () => openSetupModal("classrooms")
                            },
                            {
                              id: "open",
                              label: t("openClass"),
                              icon: "open_in_new",
                              onSelect: () => {
                                window.location.href = `/dashboard/structure/rooms/${row.classroomId}`;
                              }
                            }
                          ]}
                        />
                      ) : (
                        <TrailLink
                          href={`/dashboard/structure/rooms/${row.classroomId}`}
                          className={cn("pds-type-body-m-medium", styles.teacherProfileRowAction)}
                          from={{ label: teacher.fullName, href: teacherHref }}
                        >
                          {t("openClass")} ›
                        </TrailLink>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className={styles.teacherProfileCard}>
            <div className={styles.teacherProfileCardHead}>
              <div>
                <h2 className={cn("pds-type-title-xs-bold", styles.teacherProfileCardTitle)}>
                  {t("assignedGradesTitle")}
                </h2>
                {assignedGrades.length ? (
                  <p className={cn("pds-type-body-s-regular", styles.teacherProfileCardSubtitle)}>
                    {t("assignedGradesSummary", { count: assignedGrades.length })}
                  </p>
                ) : null}
              </div>
              {canManageHr ? (
                <button
                  type="button"
                  className={cn("pds-type-body-m-medium", styles.teacherProfileManageBtn)}
                  onClick={() => openSetupModal("grades")}
                >
                  <Icon name="edit" size={18} />
                  {t("manageGrades")}
                </button>
              ) : null}
            </div>
            {assignedGrades.length === 0 ? (
              <p className={cn("pds-type-body-s-regular", styles.teacherProfileEmpty)}>
                {t("assignedGradesEmpty")}
              </p>
            ) : (
              <ul className={styles.teacherProfileAssignedGradeList}>
                {assignedGrades.map((row) => (
                  <li key={row.gradeId} className={styles.teacherProfileAssignedGradeRow}>
                    <span className={styles.teacherProfileGradeIcon}>
                      <Icon name="school" size={18} />
                    </span>
                    <div className={styles.teacherProfileRowBody}>
                      <span className={cn("pds-type-body-m-bold", styles.teacherProfileRowTitle)}>
                        {row.gradeName}
                      </span>
                      {row.academicYearName ? (
                        <span className={cn("pds-type-body-s-regular", styles.teacherProfileRowMeta)}>
                          {row.academicYearName}
                        </span>
                      ) : null}
                    </div>
                    <Badge tone={row.isGradeChief ? "brand" : "neutral"}>
                      {row.isGradeChief ? t("gradeChiefBadge") : t("notGradeChiefRole")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {activeTab === "salary" && canManageHr ? (
        <StaffCompensationSection staffId={teacherId} className={styles.teacherProfileSalaryPanel} />
      ) : null}

      <TeacherEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        teacher={teacher}
        onSaved={() => void profile.refetch()}
      />

      <RecordFormSheet
        open={setupModal === "subjects"}
        contentClassName="record-modal--teaching-setup"
        onOpenChange={(open) => {
          if (!open) {
            setSetupModal((current) => (current === "subjects" ? null : current));
          }
        }}
        onOpenAutoFocus={(event) => event.preventDefault()}
        title={t("manageSubjectsTitle")}
        help={t("manageSubjectsHelp")}
        onSubmit={(event) => {
          event.preventDefault();
          void saveTeachingSetup("subjects");
        }}
        footer={
          <>
            <button
              type="button"
              className="pds-type-body-m-bold btn-ghost"
              onClick={() => setSetupModal(null)}
            >
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="pds-type-body-m-bold btn-primary"
              disabled={updateTeachingSetup.isPending}
            >
              {updateTeachingSetup.isPending ? c("loading") : c("save")}
            </button>
          </>
        }
      >
        <TeacherSubjectsSetupFields
          draft={draft}
          onChange={setDraft}
          options={options.data}
          loading={setupFieldsLoading}
        />
        {formError && setupModal === "subjects" ? (
          <p className="pds-type-body-m-medium error-text">{formError}</p>
        ) : null}
      </RecordFormSheet>

      <RecordFormSheet
        open={setupModal === "grades"}
        contentClassName="record-modal--teaching-setup"
        onOpenChange={(open) => {
          if (!open) {
            setSetupModal((current) => (current === "grades" ? null : current));
          }
        }}
        onOpenAutoFocus={(event) => event.preventDefault()}
        title={t("manageGradesTitle")}
        help={t("manageGradesHelp")}
        onSubmit={(event) => {
          event.preventDefault();
          void saveTeachingSetup("grades");
        }}
        footer={
          <>
            <button
              type="button"
              className="pds-type-body-m-bold btn-ghost"
              onClick={() => setSetupModal(null)}
            >
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="pds-type-body-m-bold btn-primary"
              disabled={updateTeachingSetup.isPending}
            >
              {updateTeachingSetup.isPending ? c("loading") : c("save")}
            </button>
          </>
        }
      >
        <TeacherGradesSetupFields
          draft={draft}
          onChange={setDraft}
          options={options.data}
          currentStaffId={teacherId}
          loading={setupFieldsLoading}
        />
        {formError && setupModal === "grades" ? (
          <p className="pds-type-body-m-medium error-text">{formError}</p>
        ) : null}
      </RecordFormSheet>

      <RecordFormSheet
        open={setupModal === "classrooms"}
        contentClassName="record-modal--teaching-setup"
        onOpenChange={(open) => {
          if (!open) {
            setSetupModal((current) => (current === "classrooms" ? null : current));
          }
        }}
        onOpenAutoFocus={(event) => event.preventDefault()}
        title={t("manageClassroomsTitle")}
        help={t("manageClassroomsHelp")}
        onSubmit={(event) => {
          event.preventDefault();
          void saveTeachingSetup("classrooms");
        }}
        footer={
          <>
            <button
              type="button"
              className="pds-type-body-m-bold btn-ghost"
              onClick={() => setSetupModal(null)}
            >
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="pds-type-body-m-bold btn-primary"
              disabled={updateTeachingSetup.isPending}
            >
              {updateTeachingSetup.isPending ? c("loading") : c("save")}
            </button>
          </>
        }
      >
        <TeacherClassroomsSetupFields
          draft={draft}
          onChange={setDraft}
          options={options.data}
          currentStaffId={teacherId}
          loading={setupFieldsLoading}
        />
        {formError && setupModal === "classrooms" ? (
          <p className="pds-type-body-m-medium error-text">{formError}</p>
        ) : null}
      </RecordFormSheet>

      <ConfirmDialog
        open={confirmSaveKind !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmSaveKind(null);
          }
        }}
        title={t("roleConflictTitle")}
        description={
          confirmSaveKind === "grades" && chiefConflictRows.length
            ? t("chiefConflictConfirm", {
                items: chiefConflictRows
                  .map((item) => `${item.gradeName} (${item.staffName})`)
                  .join(", ")
              })
            : confirmSaveKind === "classrooms" && homeroomConflictRows.length
              ? t("homeroomConflictConfirm", {
                  items: homeroomConflictRows.map((item) => item.classroomName).join(", ")
                })
              : ""
        }
        confirmLabel={t("roleConflictOverride")}
        cancelLabel={c("cancel")}
        loading={updateTeachingSetup.isPending}
        onConfirm={() => {
          if (confirmSaveKind === "grades") {
            void saveTeachingSetup("grades", true);
            return;
          }
          if (confirmSaveKind === "classrooms") {
            void saveTeachingSetup("classrooms", true);
          }
        }}
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
        loading={updateStaffStatus.isPending}
        onConfirm={() => void confirmStatusChange()}
      />

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={t("archiveTeacherTitle")}
        description={t("archiveTeacherHelp")}
        confirmLabel={c("archive")}
        cancelLabel={c("cancel")}
        destructive
        loading={archiveTeacher.isPending}
        onConfirm={() => void handleArchive()}
      />

      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title={t("restoreTeacherTitle")}
        description={t("restoreTeacherHelp")}
        confirmLabel={c("restore")}
        cancelLabel={c("cancel")}
        loading={restoreTeacher.isPending}
        onConfirm={() => void handleRestore()}
      />

      <ConfirmDialog
        open={deleteForeverOpen}
        onOpenChange={setDeleteForeverOpen}
        title={t("deleteTeacherTitle")}
        description={t("deleteTeacherHelp")}
        confirmLabel={c("deletePermanently")}
        cancelLabel={c("cancel")}
        destructive
        loading={deleteTeacher.isPending}
        onConfirm={() => void handlePermanentDelete()}
      />
    </div>
  );
}
