"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { FilterTab, FilterTabGroup } from "../../../components/pds/composites/filter-tabs";
import { useApiQuery } from "../../lib/api";
import { hasAnyPermission } from "../../lib/permissions";
import { getSession } from "../../lib/session";
import { PageHeader } from "../page-header-context";
import { GuardiansDirectory } from "./guardians-directory";
import { HouseholdsDirectory } from "./households-directory";
import {
  PeopleDirectoryActionsProvider,
  PeopleDirectoryHeaderActionsPortal,
  type PeopleDirectoryTab
} from "./people-directory-actions";
import { peopleDirectoryCountsPath, type PeopleDirectoryCounts } from "./people-directory-counts";
import { StudentsDirectory } from "./students-directory";

export default function PeoplePage() {
  const t = useTranslations("people");
  const nav = useTranslations("nav");
  const permissions = getSession()?.permissions;
  const searchParams = useSearchParams();
  const router = useRouter();

  const canViewStudents = hasAnyPermission(permissions, ["student.view", "student.manage"]);

  const tabParam = searchParams.get("tab");
  const tab: PeopleDirectoryTab =
    tabParam === "guardians" && canViewStudents
      ? "guardians"
      : tabParam === "households" && canViewStudents
        ? "households"
        : "students";

  const counts = useApiQuery<PeopleDirectoryCounts>((tenant) =>
    canViewStudents ? peopleDirectoryCountsPath(tenant) : null
  );

  useEffect(() => {
    if (!canViewStudents) {
      router.replace("/dashboard");
    }
  }, [canViewStudents, router]);

  function setTab(next: PeopleDirectoryTab) {
    router.replace(`/dashboard/people?tab=${next}`, { scroll: false });
  }

  if (!canViewStudents) {
    return null;
  }

  const tabCounts = counts.data;

  // Trail segment must reflect the active tab so detail pages' back links
  // return to the tab the user actually came from.
  const tabLabel =
    tab === "guardians"
      ? t("guardiansTab")
      : tab === "households"
        ? t("householdsTab")
        : nav("students");
  const tabSegment = { label: tabLabel, href: `/dashboard/people?tab=${tab}` };

  return (
    <PeopleDirectoryActionsProvider activeTab={tab}>
      <div className="directory-page">
        <PageHeader
          title={t("studentsDirectoryTitle")}
          actionsPortal
          resetTrail={[tabSegment]}
          segment={tabSegment}
        />

        <PeopleDirectoryHeaderActionsPortal />

        <nav aria-label={t("studentsDirectoryTitle")}>
          <FilterTabGroup>
            <FilterTab
              label={t("studentsTab")}
              count={tabCounts?.students}
              active={tab === "students"}
              onClick={() => setTab("students")}
            />
            <FilterTab
              label={t("guardiansTab")}
              count={tabCounts?.guardians}
              active={tab === "guardians"}
              onClick={() => setTab("guardians")}
            />
            <FilterTab
              label={t("householdsTab")}
              count={tabCounts?.households}
              active={tab === "households"}
              onClick={() => setTab("households")}
            />
          </FilterTabGroup>
        </nav>

        {tab === "students" ? <StudentsDirectory /> : null}
        {tab === "guardians" ? <GuardiansDirectory /> : null}
        {tab === "households" ? <HouseholdsDirectory /> : null}
      </div>
    </PeopleDirectoryActionsProvider>
  );
}
