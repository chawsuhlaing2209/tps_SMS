"use client";

import { useTranslations } from "next-intl";
import { EnrollmentsWorkspace } from "./enrollments-workspace";
import { PageHeader } from "../page-header-context";

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
