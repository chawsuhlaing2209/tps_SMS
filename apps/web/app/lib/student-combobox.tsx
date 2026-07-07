"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { PdsSelect } from "../../components/pds";
import { useApiQuery } from "./api";

type StudentOption = { id: string; fullName: string; admissionNumber?: string | null };

type Props = {
  value: string;
  onChange: (studentId: string) => void;
  excludeIds?: string[];
  disabled?: boolean;
};

function studentLabel(student: { fullName: string; admissionNumber?: string | null }) {
  return `${student.fullName}${
    student.admissionNumber ? ` (${student.admissionNumber})` : ""
  }`;
}

export function StudentCombobox({ value, onChange, excludeIds = [], disabled }: Props) {
  const t = useTranslations("students");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const path = debounced
    ? (tenant: string) =>
        `/tenants/${tenant}/students?search=${encodeURIComponent(debounced)}&limit=20`
    : (tenant: string) => `/tenants/${tenant}/students?limit=20`;

  const students = useApiQuery<{ data: StudentOption[] }>((tenant) =>
    disabled ? null : path(tenant)
  );

  const selectedStudent = useApiQuery<{ fullName: string; admissionNumber: string }>((tenant) =>
    value && !disabled ? `/tenants/${tenant}/students/${value}` : null
  );

  const exclude = useMemo(() => new Set(excludeIds), [excludeIds]);
  const options = students.data?.data.filter((student) => !exclude.has(student.id)) ?? [];

  const items = useMemo(() => {
    const fromSearch = options.map((student) => ({
      id: student.id,
      label: studentLabel(student),
    }));

    if (
      value &&
      selectedStudent.data &&
      !fromSearch.some((item) => item.id === value)
    ) {
      return [
        { id: value, label: studentLabel(selectedStudent.data) },
        ...fromSearch,
      ];
    }

    return fromSearch;
  }, [options, selectedStudent.data, value]);

  return (
    <PdsSelect
      searchable
      variant="form"
      value={value}
      onValueChange={(next) => onChange(typeof next === "string" ? next : "")}
      onSearchChange={setSearch}
      items={items}
      placeholder={t("searchStudents")}
      state={disabled ? "disabled" : undefined}
    />
  );
}
