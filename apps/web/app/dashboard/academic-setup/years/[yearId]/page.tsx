"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApiQuery } from "../../../../lib/api";
import { Icon } from "../../../../lib/icon";
import { PageHeader } from "../../../page-header-context";

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

export default function AcademicYearDetailPage() {
  const params = useParams<{ yearId: string }>();
  const yearId = params.yearId;
  const t = useTranslations("academics");
  const setup = useTranslations("academicSetup");
  const nav = useTranslations("nav");
  const c = useTranslations("common");

  const years = useApiQuery<AcademicYearOverview[]>(SETUP_PATH);
  const year = years.data?.find((row) => row.id === yearId);

  return (
    <>
      <PageHeader
        title={year?.name ?? t("years")}
        breadcrumbs={[
          { label: nav("academicSetup") },
          { label: setup("years"), href: "/dashboard/academic-setup/years" }
        ]}
        backHref="/dashboard/academic-setup/years"
        backLabel={setup("years")}
      />

      {years.isLoading ? (
        <p className="muted">{c("loading")}</p>
      ) : !year ? (
        <p className="muted">{c("empty")}</p>
      ) : (
        <section className="panel setup-year-detail">
          <div className="setup-year-detail__main">
            <p className="setup-year-detail__dates">
              {formatDateRange(year.startsOn, year.endsOn)}
            </p>
            <p className="muted">
              {t("gradeCount")}: {year.gradeCount} · {t("classroomCount")}: {year.classroomCount} ·{" "}
              {t("studentCount")}: {year.studentCount}
            </p>
            <p className="setup-year-detail__hint">{setup("yearGradesMovedHelp")}</p>
            <Link href="/dashboard/academic-setup/grades-classrooms" className="btn-primary">
              <Icon name="meeting_room" />
              {setup("gradesClassrooms")}
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
