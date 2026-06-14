"use client";

import { useTranslations } from "next-intl";
import { ResourcePanel, useAcademicResource } from "../shared";

type Grade = { id: string; name: string; sortOrder: number; status: string };

export default function GradesPage() {
  const t = useTranslations("academics");
  const c = useTranslations("common");
  const { query, create } = useAcademicResource<Grade>("grades");

  return (
    <ResourcePanel
      title={t("grades")}
      query={query}
      columns={[c("name"), t("order"), c("status")]}
      toRow={(g) => [g.name, String(g.sortOrder), g.status]}
      quickAdd={{
        label: t("gradeName"),
        placeholder: t("gradeNamePlaceholder"),
        onSubmit: async (name) => {
          await create.mutateAsync({ name });
        }
      }}
    />
  );
}
