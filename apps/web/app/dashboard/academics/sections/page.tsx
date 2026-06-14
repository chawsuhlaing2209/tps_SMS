"use client";

import { useTranslations } from "next-intl";
import { ResourcePanel, useAcademicResource } from "../shared";

type Section = { id: string; name: string; status: string };

export default function SectionsPage() {
  const t = useTranslations("academics");
  const c = useTranslations("common");
  const { query, create } = useAcademicResource<Section>("sections");

  return (
    <ResourcePanel
      title={t("sections")}
      query={query}
      columns={[c("name"), c("status")]}
      toRow={(s) => [s.name, s.status]}
      quickAdd={{
        label: t("sectionName"),
        placeholder: t("sectionNamePlaceholder"),
        onSubmit: async (name) => {
          await create.mutateAsync({ name });
        }
      }}
    />
  );
}
