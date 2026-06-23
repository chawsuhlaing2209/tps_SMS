"use client";

import { updateTeacherTeachingSetupSchema } from "@sms/shared";
import { cn } from "../../../../lib/utils";
import { useTranslations } from "next-intl";
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
  TeacherTeachingSetupFields,
  teachingSetupToDraft,
  type TeachingSetupDraft,
  type TeachingSetupOptions
} from "../teacher-teaching-setup";
import styles from "../teacher-profile.module.css";
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
  const [teachingOpen, setTeachingOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
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

  useEffect(() => {
    if (!teachingOpen || !existingSetup.data) {
      return;
    }
    setDraft(teachingSetupToDraft(existingSetup.data, options.data));
  }, [teachingOpen, existingSetup.data, options.data]);

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
  const hasRoleConflicts = chiefConflictRows.length > 0 || homeroomConflictRows.length > 0;

  async function saveTeachingSetup() {
    setFormError(null);
    const parsed = updateTeacherTeachingSetupSchema.safeParse(
      draftToTeachingSetup(draft, options.data)
    );
    if (!parsed.success) {
      setFormError(c("somethingWrong"));
      return;
    }
    try {
      await updateTeachingSetup.mutateAsync(parsed.data);
      setConfirmOpen(false);
      setTeachingOpen(false);
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

  function openTeachingSetup() {
    setFormError(null);
    if (existingSetup.data) {
      setDraft(teachingSetupToDraft(existingSetup.data, options.data));
    }
    setTeachingOpen(true);
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
        avatar={{ initials: initials(teacher.fullName), tone: "teacher" }}
        title={teacher.fullName}
        status={
          <span
            className={cn(
              "pds-detail-card-status",
              isTeacherActive && styles.teacherProfileStatusActive
            )}
          >
            {isTeacherActive ? t("statusActive") : t("statusInactive")}
          </span>
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
                    id: "manage-teaching",
                    label: t("manageTeaching"),
                    icon: "school",
                    onSelect: () => openTeachingSetup()
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
                    : [])
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
      ) : null}

      {activeTab === "teaching" ? (
        <div className={styles.teacherProfileTabGrid}>
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
                  onClick={openTeachingSetup}
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
                            onSelect: openTeachingSetup
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
            {formError && !teachingOpen ? (
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
                  onClick={openTeachingSetup}
                >
                  <Icon name="edit" size={18} />
                  {t("manageTeaching")}
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
                            onSelect: openTeachingSetup
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
        open={teachingOpen}
        onOpenChange={setTeachingOpen}
        title={t("manageTeachingTitle")}
        help={t("manageTeachingHelp")}
        onSubmit={(event) => {
          event.preventDefault();
          if (hasRoleConflicts) {
            setConfirmOpen(true);
            return;
          }
          void saveTeachingSetup();
        }}
        footer={
          <>
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setTeachingOpen(false)}>
              {c("cancel")}
            </button>
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={updateTeachingSetup.isPending}>
              {updateTeachingSetup.isPending ? c("loading") : c("save")}
            </button>
          </>
        }
      >
        <TeacherTeachingSetupFields
          draft={draft}
          onChange={setDraft}
          options={options.data}
          currentStaffId={teacherId}
          loading={options.isLoading || existingSetup.isLoading}
        />
        {formError ? <p className="pds-type-body-m-medium error-text">{formError}</p> : null}
      </RecordFormSheet>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("roleConflictTitle")}
        description={[
          chiefConflictRows.length
            ? t("chiefConflictConfirm", {
                items: chiefConflictRows
                  .map((item) => `${item.gradeName} (${item.staffName})`)
                  .join(", ")
              })
            : null,
          homeroomConflictRows.length
            ? t("homeroomConflictConfirm", {
                items: homeroomConflictRows.map((item) => item.classroomName).join(", ")
              })
            : null
        ]
          .filter(Boolean)
          .join(" ")}
        confirmLabel={t("roleConflictOverride")}
        cancelLabel={c("cancel")}
        loading={updateTeachingSetup.isPending}
        onConfirm={() => void saveTeachingSetup()}
      />
    </div>
  );
}
