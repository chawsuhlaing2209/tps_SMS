"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { PageHeader } from "../page-header-context";
import { WorkspaceLoading } from "../../lib/workspace-loading";

const EnrollmentsWorkspace = dynamic(
  () => import("./enrollments-workspace").then((module) => module.EnrollmentsWorkspace),
  { loading: () => <WorkspaceLoading /> }
);

export default function EnrollmentsPage() {
  const t = useTranslations("enrollments");
  const nav = useTranslations("nav");

  return (
    <div className="page-stack">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: nav("group_business") }, { label: nav("enrollments") }]}
      />
      <EnrollmentsWorkspace />
    </div>
  );
}
