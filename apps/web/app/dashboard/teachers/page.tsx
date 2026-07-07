"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "../page-header-context";
import {
  TeachersActionsProvider,
  TeachersHeaderActionsPortal
} from "./teachers-actions-provider";
import { TeachersDirectory } from "./teachers-directory";

export default function TeachersPage() {
  const t = useTranslations("teachers");
  const nav = useTranslations("nav");

  return (
    <TeachersActionsProvider>
      <div className="directory-page">
        <PageHeader
          title={t("title")}
          description={t("description")}
          actionsPortal
          resetTrail={[{ label: nav("teachers"), href: "/dashboard/teachers" }]}
          segment={{ label: nav("teachers"), href: "/dashboard/teachers" }}
        />

        <TeachersHeaderActionsPortal />
        <TeachersDirectory />
      </div>
    </TeachersActionsProvider>
  );
}
