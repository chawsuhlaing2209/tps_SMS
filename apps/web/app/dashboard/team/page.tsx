"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "../page-header-context";
import { TeamEditor } from "./team-editor";

export default function TeamPage() {
  const t = useTranslations("team");
  const nav = useTranslations("nav");

  return (
    <div className="directory-page">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: nav("group_admin") }, { label: nav("team") }]}
        actionsPortal
      />
      <TeamEditor />
    </div>
  );
}
