"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useReferenceApiQuery } from "../../../../lib/api";
import { Icon } from "../../../../lib/material-icon";
import { PageHeader } from "../../../page-header-context";
import { StatusBadge } from "../../../../../components/shared/badge";
import { EmptyState } from "../../../../../components/shared/empty-state";
import { StatCard, StatGrid } from "../../../../../components/shared/stat-card";

type AcademicYearOverview = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: string;
  gradeCount: number;
  classroomCount: number;
  studentCount: number;
};

const SETUP_PATH = (tenant: string) => `/tenants/${tenant}/academics/setup/academic-years`;

function formatDateRange(startsOn: string, endsOn: string) {
  const fmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
  return `${fmt.format(new Date(startsOn))} → ${fmt.format(new Date(endsOn))}`;
}

export default function AcademicYearDetailPage({
  params
}: {
  params: Promise<{ yearId: string }>;
}) {
  const { yearId } = use(params);
  const t = useTranslations("academics");
  const setup = useTranslations("academicSetup");
  const nav = useTranslations("nav");
  const c = useTranslations("common");

  const years = useReferenceApiQuery<AcademicYearOverview[]>(SETUP_PATH);
  const year = years.data?.find((row) => row.id === yearId);

  return (
    <>
      <PageHeader
        title={year?.name ?? t("years")}
        breadcrumbs={[
          { label: nav("group_academics") },
          { label: setup("years"), href: "/dashboard/academic-setup/years" }
        ]}
      />

      {years.isLoading ? (
        <p className="pds-type-body-s-regular muted">{c("loading")}</p>
      ) : !year ? (
        <section className="panel">
          <EmptyState compact embedded icon="event_busy" title={c("empty")} />
        </section>
      ) : (
        <section className="panel setup-year-detail">
          <div className="setup-year-detail__head">
            <p className="pds-type-title-xs-bold setup-year-detail__dates">
              {formatDateRange(year.startsOn, year.endsOn)}
            </p>
            <StatusBadge status={year.status} />
          </div>

          <StatGrid>
            <StatCard
              icon={<Icon name="school" size={18} />}
              label={t("gradeCount")}
              value={year.gradeCount}
            />
            <StatCard
              icon={<Icon name="meeting_room" size={18} />}
              label={t("classroomCount")}
              value={year.classroomCount}
            />
            <StatCard
              icon={<Icon name="groups" size={18} />}
              label={t("studentCount")}
              value={year.studentCount}
            />
          </StatGrid>

          <div className="setup-year-detail__footer">
            <p className="pds-type-body-s-regular setup-year-detail__hint">{setup("yearGradesMovedHelp")}</p>
            <Link href="/dashboard/academic-setup/grades-classrooms" className="pds-type-body-m-bold btn-primary">
              <Icon name="meeting_room" />
              {setup("gradesClassrooms")}
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
