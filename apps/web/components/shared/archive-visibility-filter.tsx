"use client";

import { useTranslations } from "next-intl";
import { SegmentedControl } from "../pds";
import type { ArchiveVisibility } from "../../app/lib/archive-filter";

export type ArchiveVisibilityFilterProps = {
  value: ArchiveVisibility;
  onChange: (value: ArchiveVisibility) => void;
  className?: string;
};

export function ArchiveVisibilityFilter({
  value,
  onChange,
  className
}: ArchiveVisibilityFilterProps) {
  const t = useTranslations("common");

  return (
    <SegmentedControl
      className={className}
      ariaLabel={t("archiveVisibilityLabel")}
      value={value}
      onChange={(id) => onChange(id as ArchiveVisibility)}
      options={[
        { id: "active", label: t("archiveVisibilityActive") },
        { id: "archived", label: t("archiveVisibilityArchived") },
        { id: "all", label: t("archiveVisibilityAll") }
      ]}
    />
  );
}
