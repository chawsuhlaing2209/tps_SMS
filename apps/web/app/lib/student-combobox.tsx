"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useApiQuery } from "./api";
import { Icon } from "./icon";
import { TableSearchInput } from "./table-search";

type StudentOption = { id: string; fullName: string; admissionNumber?: string | null };

type Props = {
  value: string;
  onChange: (studentId: string) => void;
  excludeIds?: string[];
  disabled?: boolean;
};

export function StudentCombobox({ value, onChange, excludeIds = [], disabled }: Props) {
  const t = useTranslations("students");
  const c = useTranslations("common");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

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

  const displayLabel =
    selectedLabel ??
    (selectedStudent.data
      ? `${selectedStudent.data.fullName}${
          selectedStudent.data.admissionNumber ? ` (${selectedStudent.data.admissionNumber})` : ""
        }`
      : null);

  return (
    <div className="combobox">
      {value && displayLabel ? (
        <div className="combobox-selected">
          <span>{displayLabel}</span>
          <button
            type="button"
            className="btn-ghost"
            disabled={disabled}
            onClick={() => {
              onChange("");
              setSelectedLabel(null);
              setSearch("");
            }}
          >
            <Icon name="close" />
            {c("clear")}
          </button>
        </div>
      ) : (
        <>
          <TableSearchInput
            placeholder={t("searchStudents")}
            aria-label={t("searchStudents")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={disabled}
          />
          {students.isLoading ? <p className="muted">{c("loading")}</p> : null}
          {students.isError ? (
            <p className="error-text" role="alert">
              {c("somethingWrong")}
            </p>
          ) : null}
          {!students.isLoading && !students.isError && debounced && options.length === 0 ? (
            <p className="muted">{t("noSearchResults")}</p>
          ) : null}
          {options.length > 0 ? (
            <ul className="combobox-results" role="listbox" aria-label={t("searchStudents")}>
              {options.map((student) => {
                const label = `${student.fullName}${
                  student.admissionNumber ? ` (${student.admissionNumber})` : ""
                }`;
                return (
                  <li key={student.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === student.id}
                      className={
                        value === student.id
                          ? "combobox-result combobox-result--active"
                          : "combobox-result"
                      }
                      onClick={() => {
                        setSelectedLabel(label);
                        onChange(student.id);
                        setSearch("");
                      }}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}
