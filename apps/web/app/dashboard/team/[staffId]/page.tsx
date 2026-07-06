"use client";

import { roleDisplayFor } from "@sms/shared";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState, use } from "react";
import { cn } from "../../../../lib/utils";
import { DetailCard } from "../../../../components/pds";
import { SegmentedControl } from "../../../../components/pds/composites/segmented-control";
import { StatusPill } from "../../../../components/pds/subcomponents/status-pill";
import { StatusBadge } from "../../../../components/shared/badge";
import { ConfirmDialog } from "../../../../components/shared/confirm-dialog";
import { NavigationBackLink } from "../../../../components/shared/navigation-back-link";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { HeroMoreActionsMenu, HeroPrimaryAction } from "../../../lib/hero-more-actions";
import { Icon } from "../../../lib/material-icon";
import { hasAnyPermission } from "../../../lib/permissions";
import { localizedRoleLabel } from "../../../lib/role-label";
import { getSession } from "../../../lib/session";
import { PageHeader } from "../../page-header-context";
import { StaffCompensationSection } from "../../salary/staff-compensation-section";
import { subjectColor } from "../../structure/subject-colors";
import styles from "../../teachers/teacher-profile.module.css";
import { TeamMemberFormSheet, type EditableTeamMember } from "../team-member-form-sheet";

type StaffProfile = {
  id: string;
  fullName: string;
  employeeNumber: string | null;
  employmentRole: string;
  department: string | null;
  departmentId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  joinDate: string | null;
  promotionTitle: string | null;
  status: string;
  archivedAt: string | null;
  userId: string | null;
  loginEmail: string | null;
  loginStatus: string | null;
  rbacRoleKey: string | null;
};

type ProfileTab = "overview" | "salary";

const profilePath = (tenant: string, staffId: string) =>
  `/tenants/${tenant}/hr/staff/${staffId}/profile`;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
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

export default function StaffProfilePage({
  params
}: {
  params: Promise<{ staffId: string }>;
}) {
  const t = useTranslations("team");
  const tTeachers = useTranslations("teachers");
  const tNames = useTranslations("settings.roles.names");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const router = useRouter();
  const { staffId } = use(params);
  const permissions = getSession()?.permissions;
  const canManageHr = hasAnyPermission(permissions, ["hr.manage"]);

  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState<"deactivate" | "activate" | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [deleteForeverOpen, setDeleteForeverOpen] = useState(false);

  const profile = useApiQuery<StaffProfile>((tenant) => profilePath(tenant, staffId));

  const updateStaffStatus = useApiMutation(
    (body: { employmentStatus: string }, tenant) => ({
      path: `/tenants/${tenant}/hr/staff/${staffId}/provision`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        profilePath(tenant, staffId),
        `/tenants/${tenant}/hr/staff/overview`
      ]
    }
  );

  const archiveStaff = useApiMutation<Record<string, never>>(
    (_body, tenant) => ({
      path: `/tenants/${tenant}/hr/staff/${staffId}/archive`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [profilePath(tenant, staffId)] }
  );

  const restoreStaff = useApiMutation<Record<string, never>>(
    (_body, tenant) => ({
      path: `/tenants/${tenant}/hr/staff/${staffId}/restore`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [profilePath(tenant, staffId)] }
  );

  const deleteStaff = useApiMutation<Record<string, never>>(
    (_body, tenant) => ({
      path: `/tenants/${tenant}/hr/staff/${staffId}`,
      init: { method: "DELETE" }
    })
  );

  const tabOptions = useMemo(
    () => [
      { id: "overview", label: t("tabOverview") },
      ...(canManageHr ? [{ id: "salary", label: tTeachers("tabSalaryCompensation") }] : [])
    ],
    [canManageHr, t, tTeachers]
  );

  const editableMember: EditableTeamMember | null = useMemo(() => {
    if (!profile.data) {
      return null;
    }
    return {
      id: profile.data.id,
      fullName: profile.data.fullName,
      email: profile.data.email,
      phone: profile.data.phone,
      departmentId: profile.data.departmentId,
      joinDate: profile.data.joinDate,
      userId: profile.data.userId,
      loginEmail: profile.data.loginEmail,
      rbacRoleKey: profile.data.rbacRoleKey
    };
  }, [profile.data]);

  if (profile.isLoading) {
    return <p className="pds-type-body-s-regular muted">{c("loading")}</p>;
  }

  if (profile.isError || !profile.data) {
    return <p className="pds-type-body-m-medium error-text">{c("somethingWrong")}</p>;
  }

  const member = profile.data;
  const isActive = member.status === "active" || member.status === "probation";
  const roleLabel = member.rbacRoleKey
    ? localizedRoleLabel(roleDisplayFor(member.rbacRoleKey), tNames)
    : member.employmentRole;
  const metaLine = [
    member.promotionTitle ?? roleLabel,
    member.department,
    member.joinDate ? t("joinedOn", { date: formatProfileDate(member.joinDate) }) : null
  ]
    .filter(Boolean)
    .join(" · ");

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

  return (
    <div className={styles.teacherProfilePage}>
      <PageHeader
        title={t("profileTitle")}
        segment={{ label: member.fullName, href: `/dashboard/team/${staffId}` }}
        breadcrumbs={[
          { label: nav("group_admin") },
          { label: nav("team"), href: "/dashboard/team" },
          { label: member.fullName }
        ]}
      />

      <NavigationBackLink fallback={{ label: nav("team"), href: "/dashboard/team" }} />

      <DetailCard
        className={styles.teacherProfileDetailCard}
        avatar={{
          initials: initials(member.fullName),
          tone: "custom",
          background: subjectColor(member.fullName).bg
        }}
        title={member.fullName}
        status={
          <StatusPill tone={isActive ? "active" : "inactive"}>
            {isActive ? tTeachers("statusActive") : tTeachers("statusInactive")}
          </StatusPill>
        }
        meta={metaLine || undefined}
        actions={
          canManageHr ? (
            <>
              <HeroMoreActionsMenu
                label={c("moreActions")}
                items={[
                  {
                    id: "status",
                    label: isActive ? tTeachers("setAsInactive") : tTeachers("markActive"),
                    icon: isActive ? "pause_circle" : "check_circle",
                    onSelect: () => setStatusConfirm(isActive ? "deactivate" : "activate")
                  },
                  ...(member.email
                    ? [
                        {
                          id: "email",
                          label: t("email"),
                          icon: "mail",
                          onSelect: () => {
                            window.location.href = `mailto:${member.email}`;
                          }
                        }
                      ]
                    : []),
                  ...(member.archivedAt
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
                {t("editMember")}
              </HeroPrimaryAction>
            </>
          ) : null
        }
      />

      <SegmentedControl
        className={styles.teacherProfileTabs}
        ariaLabel={t("profileTabsAria")}
        options={tabOptions}
        value={activeTab}
        onChange={(id) => setActiveTab(id as ProfileTab)}
      />

      {activeTab === "overview" ? (
        <section className={cn(styles.teacherProfileCard, styles.teacherProfileCardCompact)}>
          <div className={styles.teacherProfileCardHead}>
            <h2 className={cn("pds-type-title-xs-bold", styles.teacherProfileCardTitle)}>
              {tTeachers("profileSummaryTitle")}
            </h2>
          </div>
          <dl className={styles.teacherProfileSummaryGrid}>
            <div className={styles.teacherProfileSummaryItem}>
              <dt className={cn("pds-type-body-s-regular", styles.teacherProfileSummaryLabel)}>
                {t("role")}
              </dt>
              <dd className={cn("pds-type-body-m-medium", styles.teacherProfileSummaryValue)}>
                {roleLabel}
              </dd>
            </div>
            <div className={styles.teacherProfileSummaryItem}>
              <dt className={cn("pds-type-body-s-regular", styles.teacherProfileSummaryLabel)}>
                {t("email")}
              </dt>
              <dd className={cn("pds-type-body-m-medium", styles.teacherProfileSummaryValue)}>
                {member.email ?? "—"}
              </dd>
            </div>
            <div className={styles.teacherProfileSummaryItem}>
              <dt className={cn("pds-type-body-s-regular", styles.teacherProfileSummaryLabel)}>
                {t("phone")}
              </dt>
              <dd className={cn("pds-type-body-m-medium", styles.teacherProfileSummaryValue)}>
                {member.phone ?? "—"}
              </dd>
            </div>
            <div className={styles.teacherProfileSummaryItem}>
              <dt className={cn("pds-type-body-s-regular", styles.teacherProfileSummaryLabel)}>
                {t("department")}
              </dt>
              <dd className={cn("pds-type-body-m-medium", styles.teacherProfileSummaryValue)}>
                {member.department ?? "—"}
              </dd>
            </div>
            <div className={styles.teacherProfileSummaryItem}>
              <dt className={cn("pds-type-body-s-regular", styles.teacherProfileSummaryLabel)}>
                {t("joinDate")}
              </dt>
              <dd className={cn("pds-type-body-m-medium", styles.teacherProfileSummaryValue)}>
                {formatProfileDate(member.joinDate)}
              </dd>
            </div>
            <div className={styles.teacherProfileSummaryItem}>
              <dt className={cn("pds-type-body-s-regular", styles.teacherProfileSummaryLabel)}>
                {tTeachers("summaryStaffId")}
              </dt>
              <dd className={cn("pds-type-body-m-medium", styles.teacherProfileSummaryValue)}>
                {member.employeeNumber ?? "—"}
              </dd>
            </div>
            <div className={styles.teacherProfileSummaryItem}>
              <dt className={cn("pds-type-body-s-regular", styles.teacherProfileSummaryLabel)}>
                {tTeachers("summaryLoginAccount")}
              </dt>
              <dd className={cn("pds-type-body-m-medium", styles.teacherProfileSummaryValue)}>
                {member.loginEmail ?? tTeachers("loginNone")}
              </dd>
            </div>
            <div className={styles.teacherProfileSummaryItem}>
              <dt className={cn("pds-type-body-s-regular", styles.teacherProfileSummaryLabel)}>
                {c("status")}
              </dt>
              <dd className={styles.teacherProfileSummaryValue}>
                <StatusBadge status={member.status} />
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {activeTab === "salary" && canManageHr ? (
        <StaffCompensationSection staffId={staffId} className={styles.teacherProfileSalaryPanel} />
      ) : null}

      {canManageHr ? (
        <TeamMemberFormSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          member={editableMember}
          onSaved={() => void profile.refetch()}
        />
      ) : null}

      <ConfirmDialog
        open={statusConfirm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setStatusConfirm(null);
          }
        }}
        title={statusConfirm === "deactivate" ? t("deactivateTitle") : t("activateTitle")}
        description={statusConfirm === "deactivate" ? t("deactivateHelp") : t("activateHelp")}
        confirmLabel={
          statusConfirm === "deactivate" ? tTeachers("setAsInactive") : tTeachers("markActive")
        }
        cancelLabel={c("cancel")}
        loading={updateStaffStatus.isPending}
        onConfirm={() => void confirmStatusChange()}
      />

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={t("archiveTitle")}
        description={t("archiveHelp")}
        confirmLabel={c("archive")}
        cancelLabel={c("cancel")}
        destructive
        loading={archiveStaff.isPending}
        onConfirm={async () => {
          await archiveStaff.mutateAsync({});
          setArchiveOpen(false);
          void profile.refetch();
        }}
      />

      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title={t("restoreTitle")}
        description={t("restoreHelp")}
        confirmLabel={c("restore")}
        cancelLabel={c("cancel")}
        loading={restoreStaff.isPending}
        onConfirm={async () => {
          await restoreStaff.mutateAsync({});
          setRestoreOpen(false);
          void profile.refetch();
        }}
      />

      <ConfirmDialog
        open={deleteForeverOpen}
        onOpenChange={setDeleteForeverOpen}
        title={t("deleteTitle")}
        description={t("deleteHelp")}
        confirmLabel={c("deletePermanently")}
        cancelLabel={c("cancel")}
        destructive
        loading={deleteStaff.isPending}
        onConfirm={async () => {
          await deleteStaff.mutateAsync({});
          setDeleteForeverOpen(false);
          router.push("/dashboard/team");
        }}
      />
    </div>
  );
}
