"use client";

import { useTranslations } from "next-intl";
import { ResourcePanel, useAcademicResource } from "../shared";

type Subject = { id: string; name: string; code: string | null; status: string };

export default function SubjectsPage() {
  const t = useTranslations("academics");
  const c = useTranslations("common");
  const { query, create } = useAcademicResource<Subject>("subjects");

  return (
    <ResourcePanel
      title={t("subjects")}
      query={query}
      columns={[c("name"), t("code"), c("status")]}
      toRow={(s) => [s.name, s.code ?? "—", s.status]}
      quickAdd={{
        label: t("subjectName"),
        placeholder: t("subjectNamePlaceholder"),
        onSubmit: async (name) => {
          await create.mutateAsync({ name });
        }
      }}
    />
  );
}
