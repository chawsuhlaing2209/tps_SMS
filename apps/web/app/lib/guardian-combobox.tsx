"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { PdsSelect } from "../../components/pds";
import { useApiQuery } from "./api";

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

function guardianLabel(guardian: { fullName: string; phone: string | null }) {
  return `${guardian.fullName}${guardian.phone ? ` (${guardian.phone})` : ""}`;
}

export function GuardianCombobox({ value, onChange, disabled }: Props) {
  const t = useTranslations("guardians");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

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

  const items = useMemo(() => {
    const fromSearch = options.map((guardian) => ({
      id: guardian.id,
      label: guardianLabel(guardian),
    }));

    if (
      value &&
      selectedGuardian.data &&
      !fromSearch.some((item) => item.id === value)
    ) {
      return [
        { id: value, label: guardianLabel(selectedGuardian.data) },
        ...fromSearch,
      ];
    }

    return fromSearch;
  }, [options, selectedGuardian.data, value]);

  return (
    <PdsSelect
      searchable
      variant="form"
      value={value}
      onValueChange={(next) => onChange(typeof next === "string" ? next : "")}
      onSearchChange={setSearch}
      items={items}
      placeholder={t("searchGuardians")}
      state={disabled ? "disabled" : undefined}
    />
  );
}
