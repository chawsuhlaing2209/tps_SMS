"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "../page-header-context";
import { TeachersDirectory } from "./teachers-directory";

export default function TeachersPage() {
  const t = useTranslations("teachers");
  const nav = useTranslations("nav");

  return (
    <div className="directory-page">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: nav("group_school") }, { label: nav("teachers") }]}
      />
      <TeachersDirectory />
    </div>
  );
}
