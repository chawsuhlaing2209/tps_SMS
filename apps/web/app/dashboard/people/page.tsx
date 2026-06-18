"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { hasAnyPermission } from "../../lib/permissions";
import { getSession } from "../../lib/session";
import { PageHeader } from "../page-header-context";
import { GuardiansDirectory } from "./guardians-directory";
import { HouseholdsDirectory } from "./households-directory";
import { StudentsDirectory } from "./students-directory";

type DirectoryTab = "students" | "guardians" | "households";

export default function PeoplePage() {
  const t = useTranslations("people");
  const nav = useTranslations("nav");
  const permissions = getSession()?.permissions;
  const searchParams = useSearchParams();
  const router = useRouter();

  const canViewStudents = hasAnyPermission(permissions, ["student.view", "student.manage"]);

  const tabParam = searchParams.get("tab");
  const tab: DirectoryTab =
    tabParam === "guardians" && canViewStudents
      ? "guardians"
      : tabParam === "households" && canViewStudents
        ? "households"
        : "students";

  useEffect(() => {
    if (!canViewStudents) {
      router.replace("/dashboard");
    }
  }, [canViewStudents, router]);

  function setTab(next: DirectoryTab) {
    router.replace(`/dashboard/people?tab=${next}`);
  }

  if (!canViewStudents) {
    return null;
  }

  return (
    <div className="directory-page">
      <PageHeader
        title={t("studentsDirectoryTitle")}
        description={t("studentsDirectoryDescription")}
        breadcrumbs={[{ label: nav("group_school") }, { label: nav("students") }]}
      />

      <nav className="directory-tabs">
        <button
          type="button"
          className={tab === "students" ? "directory-tab directory-tab--active" : "directory-tab"}
          onClick={() => setTab("students")}
        >
          {t("studentsTab")}
        </button>
        <button
          type="button"
          className={tab === "guardians" ? "directory-tab directory-tab--active" : "directory-tab"}
          onClick={() => setTab("guardians")}
        >
          {t("guardiansTab")}
        </button>
        <button
          type="button"
          className={
            tab === "households" ? "directory-tab directory-tab--active" : "directory-tab"
          }
          onClick={() => setTab("households")}
        >
          {t("householdsTab")}
        </button>
      </nav>

      {tab === "students" ? <StudentsDirectory /> : null}
      {tab === "guardians" ? <GuardiansDirectory /> : null}
      {tab === "households" ? <HouseholdsDirectory /> : null}
    </div>
  );
}
