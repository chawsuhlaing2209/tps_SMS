"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useApiQuery } from "./api";
import { Icon } from "./material-icon";
import { TableSearchInput } from "./table-search";

type GuardianOption = {
  id: string;
  fullName: string;
  phone: string | null;
};

type Props = {
  value: string;
  onChange: (guardianId: string) => void;
  disabled?: boolean;
};

export function GuardianCombobox({ value, onChange, disabled }: Props) {
  const t = useTranslations("guardians");
  const c = useTranslations("common");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const listPath = (tenant: string) => {
    const params = new URLSearchParams({ limit: "20" });
    if (debounced) {
      params.set("search", debounced);
    }
    return `/tenants/${tenant}/students/guardians?${params.toString()}`;
  };

  const guardians = useApiQuery<GuardianOption[]>((tenant) =>
    disabled ? null : listPath(tenant)
  );

  const selectedGuardian = useApiQuery<GuardianOption>((tenant) =>
    value && !disabled ? `/tenants/${tenant}/students/guardians/${value}` : null
  );

  const options = guardians.data ?? [];

  const displayLabel =
    selectedLabel ??
    (selectedGuardian.data
      ? `${selectedGuardian.data.fullName}${
          selectedGuardian.data.phone ? ` (${selectedGuardian.data.phone})` : ""
        }`
      : null);

  const labelFor = (guardian: GuardianOption) =>
    `${guardian.fullName}${guardian.phone ? ` (${guardian.phone})` : ""}`;

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
            placeholder={t("searchGuardians")}
            aria-label={t("searchGuardians")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={disabled}
          />
          {guardians.isLoading ? <p className="muted">{c("loading")}</p> : null}
          {guardians.isError ? (
            <p className="error-text" role="alert">
              {c("somethingWrong")}
            </p>
          ) : null}
          {!guardians.isLoading && !guardians.isError && debounced && options.length === 0 ? (
            <p className="muted">{t("noSearchResults")}</p>
          ) : null}
          {options.length > 0 ? (
            <ul className="combobox-results" role="listbox" aria-label={t("searchGuardians")}>
              {options.map((guardian) => {
                const label = labelFor(guardian);
                return (
                  <li key={guardian.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === guardian.id}
                      className={
                        value === guardian.id
                          ? "combobox-result combobox-result--active"
                          : "combobox-result"
                      }
                      onClick={() => {
                        setSelectedLabel(label);
                        onChange(guardian.id);
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
