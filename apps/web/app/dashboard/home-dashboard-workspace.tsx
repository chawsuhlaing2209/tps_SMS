"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  Button,
  EntityList,
  EntityListItem,
  EntityListPanel,
  InfoCard,
  PdsSearchBar
} from "../../components/pds";
import { EmptyState } from "../../components/shared/empty-state";
import { StatCard } from "../../components/shared/stat-card";
import { useApiQuery } from "../lib/api";
import { Icon } from "../lib/material-icon";
import { Panel, PanelHead } from "../lib/panel";
import { getSession } from "../lib/session";
import { PageHeader } from "./page-header-context";

type DashboardHome = {
  academicYear: { id: string; name: string } | null;
  schoolName: string;
  currentTerm: { id: string; name: string; startsOn: string; endsOn: string } | null;
  termProgressPercent: number;
  weekLabel: string;
  approvals: { total: number; leave: number; feeWaivers: number };
  featuredGrade: { id: string; name: string } | null;
  classrooms: Array<{
    id: string;
    name: string;
    homeroomTeacherName: string | null;
    studentCount: number;
  }>;
  monthlyLeaders: Array<{
    studentName: string;
    gradeName: string;
    scorePercent: number;
  }>;
  todaySchedule: Array<{
    timeLabel: string;
    subjectName: string;
    classroomName: string;
  }>;
};

function greetingKey(hour: number): "goodMorning" | "goodAfternoon" | "goodEvening" {
  if (hour < 12) return "goodMorning";
  if (hour < 17) return "goodAfternoon";
  return "goodEvening";
}

function formatTodayDate(locale: string | undefined) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());
}

export function HomeDashboardWorkspace() {
  const t = useTranslations("overview.home");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const session = getSession();
  const displayName = session?.displayName ?? nav("signedIn");

  const home = useApiQuery<DashboardHome>((tenant) => `/tenants/${tenant}/dashboard/home`);

  const greeting = useMemo(() => greetingKey(new Date().getHours()), []);
  const todayLabel = useMemo(() => formatTodayDate(undefined), []);

  const headerActions = (
    <>
      <PdsSearchBar
        width="fluid"
        className="home-dashboard__search"
        placeholder={nav("searchPlaceholder")}
        aria-label={nav("searchPlaceholder")}
      />
      <Button asChild buttonType="filled" buttonColor="primary">
        <Link href="/dashboard/structure">
          <Icon name="add" />
          {t("create")}
        </Link>
      </Button>
    </>
  );

  return (
    <>
      <PageHeader title={nav("overview")} showTitle={false} actions={headerActions} />

      <div className="home-dashboard page-stack">
        {home.isLoading ? (
          <p className="pds-type-body-s-regular muted">{c("loading")}</p>
        ) : home.isError ? (
          <p className="pds-type-body-m-medium error-text">{c("somethingWrong")}</p>
        ) : (
          <>
            <section className="home-dashboard__hero">
              <InfoCard
                className="home-dashboard__greeting"
                badge={home.data?.currentTerm?.name ?? home.data?.academicYear?.name ?? t("noTerm")}
                title={
                  <>
                    {t(greeting)}, {displayName}
                  </>
                }
                description={
                  <div className="home-dashboard__greeting-body">
                    <p className="home-dashboard__greeting-meta">
                      {home.data?.schoolName ?? "—"} · {todayLabel}
                    </p>
                    <p className="home-dashboard__greeting-approvals">
                      {t("approvalsSummary", {
                        total: home.data?.approvals.total ?? 0,
                        leave: home.data?.approvals.leave ?? 0,
                        feeWaivers: home.data?.approvals.feeWaivers ?? 0
                      })}
                    </p>
                    <div className="home-dashboard__greeting-actions">
                      <Link href="/dashboard/structure" className="home-dashboard__ghost-btn">
                        <Icon name="account_tree" />
                        {t("openStructure")}
                      </Link>
                      {home.data?.featuredGrade ? (
                        <Link
                          href={`/dashboard/structure?gradeId=${home.data.featuredGrade.id}&tab=leaderboard`}
                          className="home-dashboard__ghost-btn"
                        >
                          <Icon name="leaderboard" />
                          {t("leaderboard")}
                        </Link>
                      ) : (
                        <span className="home-dashboard__ghost-btn home-dashboard__ghost-btn--disabled">
                          <Icon name="leaderboard" />
                          {t("leaderboard")}
                        </span>
                      )}
                    </div>
                  </div>
                }
              />

              <StatCard
                className="home-dashboard__stat home-dashboard__stat--accent"
                accent
                label={t("approvalsLabel")}
                value={home.data?.approvals.total ?? 0}
                hint={t("approvalsHint", {
                  leave: home.data?.approvals.leave ?? 0,
                  feeWaivers: home.data?.approvals.feeWaivers ?? 0
                })}
              />

              <StatCard
                className="home-dashboard__stat"
                label={t("termProgressLabel")}
                value={`${home.data?.termProgressPercent ?? 0}%`}
                hint={home.data?.weekLabel ?? t("noTerm")}
              />
            </section>

            <InfoCard
              className="home-dashboard__leaders"
              badge={t("monthlyLeadersBadge")}
              title={
                <span className="home-dashboard__leaders-heading">
                  <Icon name="emoji_events" size={22} />
                  {t("monthlyLeadersTitle")}
                </span>
              }
              description={
                home.data?.monthlyLeaders.length ? (
                  <div className="home-dashboard__leaders-body">
                    <ul className="home-dashboard__leaders-list">
                      {home.data.monthlyLeaders.map((leader) => (
                        <li key={`${leader.gradeName}-${leader.studentName}`}>
                          <span className="home-dashboard__leader-grade">{leader.gradeName}</span>
                          <span className="home-dashboard__leader-name">{leader.studentName}</span>
                          <span className="home-dashboard__leader-score">{leader.scorePercent}%</span>
                        </li>
                      ))}
                    </ul>
                    {home.data.featuredGrade ? (
                      <Link
                        href={`/dashboard/structure?gradeId=${home.data.featuredGrade.id}&tab=leaderboard`}
                        className="home-dashboard__leaders-link"
                      >
                        {t("viewAllLeaders")}
                        <Icon name="chevron_right" size={18} />
                      </Link>
                    ) : null}
                  </div>
                ) : (
                  <p className="home-dashboard__leaders-empty">{t("noLeaders")}</p>
                )
              }
            />

            <section className="home-dashboard__bottom">
              <EntityListPanel
                className="home-dashboard__classrooms"
                title={t("classroomsTitle")}
                titlePlacement="above"
                empty={!home.data?.classrooms.length ? t("noClassrooms") : undefined}
                emptyIcon="meeting_room"
                emptyAction={
                  <Button asChild buttonType="ghost" buttonColor="primary">
                    <Link href="/dashboard/structure">{t("openStructure")}</Link>
                  </Button>
                }
              >
                {home.data?.classrooms.length ? (
                  <EntityList>
                    {home.data.classrooms.map((room) => (
                      <EntityListItem
                        key={room.id}
                        title={room.name}
                        meta={
                          room.homeroomTeacherName
                            ? t("classroomMeta", {
                                teacher: room.homeroomTeacherName,
                                count: room.studentCount
                              })
                            : t("classroomMetaNoTeacher", { count: room.studentCount })
                        }
                        icon="meeting_room"
                        href={`/dashboard/structure/rooms/${room.id}`}
                        actionLabel={t("openClassroom")}
                        navigationFrom={{ label: nav("overview"), href: "/dashboard" }}
                      />
                    ))}
                  </EntityList>
                ) : null}
              </EntityListPanel>

              <Panel className="home-dashboard__schedule">
                <PanelHead title={t("scheduleTitle")} />
                <div className="panel-body">
                  {home.data?.todaySchedule.length ? (
                    <ul className="home-dashboard__schedule-list">
                      {home.data.todaySchedule.map((slot, index) => (
                        <li key={`${slot.timeLabel}-${slot.subjectName}-${index}`}>
                          <span className="home-dashboard__schedule-time">{slot.timeLabel}</span>
                          <span className="home-dashboard__schedule-subject">{slot.subjectName}</span>
                          <span className="home-dashboard__schedule-room">{slot.classroomName}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState
                      compact
                      embedded
                      icon="calendar_view_week"
                      title={t("scheduleEmpty")}
                      description={t("scheduleEmptyHelp")}
                      action={
                        <Button asChild buttonType="ghost" buttonColor="primary">
                          <Link href="/dashboard/timetable">{t("openTimetable")}</Link>
                        </Button>
                      }
                    />
                  )}
                </div>
              </Panel>
            </section>
          </>
        )}
      </div>
    </>
  );
}
