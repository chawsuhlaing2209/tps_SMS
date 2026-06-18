"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, useApiMutation, useApiQuery } from "../../lib/api";
import { Field } from "../../lib/form";
import { GuardianCombobox } from "../../lib/guardian-combobox";
import { Icon } from "../../lib/icon";
import { RecordFormSheet } from "../../lib/record-sheet";
import { TableSearchInput } from "../../lib/table-search";
import { zodResolver } from "../../lib/zod-resolver";

type HouseholdSearchResult = {
  id: string;
  name: string;
  primaryGuardianName: string | null;
  memberCount: number;
};

type GuardianDetail = {
  id: string;
  fullName: string;
  phone: string | null;
  household: { id: string; name: string } | null;
};

type RegisterStudentBody = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "M" | "F" | "other";
  admissionNumber?: string;
  guardian?: {
    guardianId?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    relationship: "father" | "mother" | "guardian" | "other";
  };
  household?: {
    mode: "none" | "existing" | "new" | "guardian_default";
    familyGroupId?: string;
    name?: string;
  };
};

type FormValues = {
  guardianMode: "existing" | "new" | "skip";
  guardianId: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianPhone: string;
  guardianEmail: string;
  guardianRelationship: "father" | "mother" | "guardian" | "other";
  householdMode: "none" | "guardian_default" | "existing" | "new";
  familyGroupId: string;
  householdName: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "M" | "F" | "other";
  admissionNumber: string;
};

const emptyValues: FormValues = {
  guardianMode: "existing",
  guardianId: "",
  guardianFirstName: "",
  guardianLastName: "",
  guardianPhone: "",
  guardianEmail: "",
  guardianRelationship: "guardian",
  householdMode: "guardian_default",
  familyGroupId: "",
  householdName: "",
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "M",
  admissionNumber: ""
};

export function StudentRegistrationWizard({
  open,
  onOpenChange,
  onSaved
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const t = useTranslations("students");
  const g = useTranslations("guardians");
  const h = useTranslations("households");
  const c = useTranslations("common");
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [householdSearch, setHouseholdSearch] = useState("");
  const [debouncedHouseholdSearch, setDebouncedHouseholdSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedHouseholdSearch(householdSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [householdSearch]);

  const schema = z.object({
    guardianMode: z.enum(["existing", "new", "skip"]),
    guardianId: z.string(),
    guardianFirstName: z.string(),
    guardianLastName: z.string(),
    guardianPhone: z.string(),
    guardianEmail: z.string(),
    guardianRelationship: z.enum(["father", "mother", "guardian", "other"]),
    householdMode: z.enum(["none", "guardian_default", "existing", "new"]),
    familyGroupId: z.string(),
    householdName: z.string(),
    firstName: z.string().trim().min(1, c("required")),
    lastName: z.string().trim().min(1, c("required")),
    dateOfBirth: z.string().min(1, c("required")),
    gender: z.enum(["M", "F", "other"]),
    admissionNumber: z.string()
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues
  });

  const guardianMode = form.watch("guardianMode");
  const guardianId = form.watch("guardianId");
  const householdMode = form.watch("householdMode");
  const guardianFirstName = form.watch("guardianFirstName");
  const guardianLastName = form.watch("guardianLastName");

  const selectedGuardian = useApiQuery<GuardianDetail>((tenant) =>
    guardianMode === "existing" && guardianId
      ? `/tenants/${tenant}/students/guardians/${guardianId}`
      : null
  );

  const householdResults = useApiQuery<{ data: HouseholdSearchResult[] }>((tenant) =>
    debouncedHouseholdSearch.length >= 2
      ? `/tenants/${tenant}/family-groups?search=${encodeURIComponent(debouncedHouseholdSearch)}`
      : null
  );

  useEffect(() => {
    if (guardianMode === "skip") {
      form.setValue("householdMode", "none");
    }
  }, [guardianMode, form]);

  useEffect(() => {
    if (guardianMode !== "new" || householdMode !== "new") {
      return;
    }
    const defaultName = `${guardianFirstName} ${guardianLastName}`.trim();
    if (!defaultName) {
      return;
    }
    const currentName = form.getValues("householdName");
    if (!currentName.trim() || currentName.endsWith(" family")) {
      form.setValue("householdName", `${defaultName} family`);
    }
  }, [guardianMode, guardianFirstName, guardianLastName, householdMode, form]);

  const register = useApiMutation<RegisterStudentBody, { id: string }>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/students`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `/tenants/${tenant}/students`,
        `/tenants/${tenant}/students/guardians`,
        `/tenants/${tenant}/family-groups`
      ]
    }
  );

  const resetForm = () => {
    form.reset(emptyValues);
    setFormError(null);
    setHouseholdSearch("");
  };

  const validateGuardian = (values: FormValues) => {
    if (values.guardianMode === "skip") {
      return true;
    }
    if (values.guardianMode === "existing") {
      if (!values.guardianId) {
        setFormError(t("registerSelectGuardian"));
        return false;
      }
      return true;
    }
    if (!values.guardianFirstName.trim() || !values.guardianLastName.trim() || !values.guardianPhone.trim()) {
      setFormError(c("required"));
      return false;
    }
    return true;
  };

  const validateHousehold = (values: FormValues) => {
    if (values.guardianMode === "skip" || values.householdMode === "none") {
      return true;
    }
    if (values.householdMode === "existing" && !values.familyGroupId) {
      setFormError(t("registerSelectHousehold"));
      return false;
    }
    if (values.householdMode === "new" && !values.householdName.trim()) {
      setFormError(c("required"));
      return false;
    }
    return true;
  };

  const buildPayload = (values: FormValues): RegisterStudentBody => {
    const payload: RegisterStudentBody = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      dateOfBirth: values.dateOfBirth,
      gender: values.gender,
      admissionNumber: values.admissionNumber.trim() || undefined
    };

    if (values.guardianMode !== "skip") {
      payload.guardian =
        values.guardianMode === "existing"
          ? {
              guardianId: values.guardianId,
              relationship: values.guardianRelationship
            }
          : {
              firstName: values.guardianFirstName.trim(),
              lastName: values.guardianLastName.trim(),
              phone: values.guardianPhone.trim(),
              email: values.guardianEmail.trim() || undefined,
              relationship: values.guardianRelationship
            };
    }

    payload.household = {
      mode:
        values.guardianMode === "skip" || values.householdMode === "none"
          ? "none"
          : values.householdMode
    };

    if (payload.household.mode === "existing") {
      payload.household.familyGroupId = values.familyGroupId;
    }
    if (payload.household.mode === "new") {
      payload.household.name = values.householdName.trim();
    }

    return payload;
  };

  const guardianHasHousehold = Boolean(selectedGuardian.data?.household);
  const guardianDisplayName =
    selectedGuardian.data?.fullName ?? `${guardianFirstName} ${guardianLastName}`.trim();

  return (
    <RecordFormSheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          resetForm();
        }
        onOpenChange(nextOpen);
      }}
      title={t("registerTitle")}
      help={t("registerHelp")}
      onSubmit={form.handleSubmit(async (values) => {
        setFormError(null);
        if (!validateGuardian(values) || !validateHousehold(values)) {
          return;
        }
        try {
          const created = await register.mutateAsync(buildPayload(values));
          resetForm();
          onOpenChange(false);
          onSaved?.();
          router.push(`/dashboard/students/${created.id}`);
        } catch (error) {
          setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
        }
      })}
      footer={
        <>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
          >
            {c("cancel")}
          </button>
          <button type="submit" className="btn-primary" disabled={register.isPending}>
            <Icon name="check" />
            {register.isPending ? c("loading") : t("registerSubmit")}
          </button>
        </>
      }
    >
      <p className="setup-form-section-label">{t("registerSectionStudent")}</p>
      <Field label={t("firstName")} error={form.formState.errors.firstName?.message}>
        <input {...form.register("firstName")} />
      </Field>
      <Field label={t("lastName")} error={form.formState.errors.lastName?.message}>
        <input {...form.register("lastName")} />
      </Field>
      <Field label={t("dateOfBirth")} error={form.formState.errors.dateOfBirth?.message}>
        <input type="date" {...form.register("dateOfBirth")} />
      </Field>
      <Field label={t("gender")} error={form.formState.errors.gender?.message}>
        <select {...form.register("gender")}>
          <option value="M">{t("genderM")}</option>
          <option value="F">{t("genderF")}</option>
          <option value="other">{t("genderOther")}</option>
        </select>
      </Field>
      <Field label={t("admissionNumber")}>
        <input placeholder={t("admissionOptional")} {...form.register("admissionNumber")} />
      </Field>

      <p className="setup-form-section-label">{t("registerSectionGuardian")}</p>
      <Field label={t("registerGuardianMode")}>
        <select {...form.register("guardianMode")}>
          <option value="existing">{t("registerGuardianExisting")}</option>
          <option value="new">{t("registerGuardianNew")}</option>
          <option value="skip">{t("registerGuardianSkip")}</option>
        </select>
      </Field>

      {guardianMode === "existing" ? (
        <>
          <Field label={g("directoryTitle")}>
            <GuardianCombobox
              value={guardianId}
              onChange={(nextId) => form.setValue("guardianId", nextId)}
            />
          </Field>
          <Field label={t("relationship")}>
            <select {...form.register("guardianRelationship")}>
              <option value="father">{g("relationship_father")}</option>
              <option value="mother">{g("relationship_mother")}</option>
              <option value="guardian">{g("relationship_guardian")}</option>
              <option value="other">{g("relationship_other")}</option>
            </select>
          </Field>
        </>
      ) : null}

      {guardianMode === "new" ? (
        <>
          <Field label={g("firstName")}>
            <input {...form.register("guardianFirstName")} />
          </Field>
          <Field label={g("lastName")}>
            <input {...form.register("guardianLastName")} />
          </Field>
          <Field label={g("phone")}>
            <input {...form.register("guardianPhone")} />
          </Field>
          <Field label={g("email")}>
            <input type="email" {...form.register("guardianEmail")} />
          </Field>
          <Field label={t("relationship")}>
            <select {...form.register("guardianRelationship")}>
              <option value="father">{g("relationship_father")}</option>
              <option value="mother">{g("relationship_mother")}</option>
              <option value="guardian">{g("relationship_guardian")}</option>
              <option value="other">{g("relationship_other")}</option>
            </select>
          </Field>
        </>
      ) : null}

      {guardianMode === "skip" ? <p className="muted">{t("registerGuardianSkipHelp")}</p> : null}

      <p className="setup-form-section-label">{t("registerSectionHousehold")}</p>
      {guardianMode === "skip" ? (
        <p className="muted">{t("registerHouseholdSkipGuardian")}</p>
      ) : (
        <>
          <Field label={t("registerHouseholdMode")}>
            <select {...form.register("householdMode")}>
              <option value="guardian_default">{t("registerHouseholdGuardianDefault")}</option>
              <option value="existing">{t("registerHouseholdExisting")}</option>
              <option value="new">{t("registerHouseholdNew")}</option>
              <option value="none">{t("registerHouseholdNone")}</option>
            </select>
          </Field>

          {householdMode === "guardian_default" ? (
            <p className="muted panel-help">
              {guardianMode === "existing" && guardianHasHousehold
                ? t("registerHouseholdJoinGuardian", {
                    name: selectedGuardian.data!.household!.name
                  })
                : t("registerHouseholdCreateGuardian", {
                    name: guardianDisplayName || g("directoryTitle")
                  })}
            </p>
          ) : null}

          {householdMode === "existing" ? (
            <>
              <Field label={h("searchHouseholds")}>
                <TableSearchInput
                  value={householdSearch}
                  onChange={(event) => setHouseholdSearch(event.target.value)}
                  placeholder={h("searchHouseholds")}
                  aria-label={h("searchHouseholds")}
                />
              </Field>
              {debouncedHouseholdSearch.length < 2 ? (
                <p className="muted">{t("searchFamilyMin")}</p>
              ) : null}
              {householdResults.data?.data.length ? (
                <ul className="combobox-results" role="listbox">
                  {householdResults.data.data.map((household) => (
                    <li key={household.id}>
                      <button
                        type="button"
                        className={
                          form.watch("familyGroupId") === household.id
                            ? "combobox-result combobox-result--active"
                            : "combobox-result"
                        }
                        onClick={() => form.setValue("familyGroupId", household.id)}
                      >
                        {household.name}
                        <span className="muted">
                          {" "}
                          · {household.memberCount} · {household.primaryGuardianName ?? "—"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : debouncedHouseholdSearch.length >= 2 && !householdResults.isLoading ? (
                <p className="muted">{t("searchFamilyEmpty")}</p>
              ) : null}
            </>
          ) : null}

          {householdMode === "new" ? (
            <Field label={h("householdName")}>
              <input
                {...form.register("householdName")}
                placeholder={h("householdNamePlaceholder")}
              />
            </Field>
          ) : null}

          {householdMode === "none" ? (
            <p className="muted">{t("registerHouseholdNoneHelp")}</p>
          ) : null}
        </>
      )}

      {formError ? (
        <p className="error-text" role="alert">
          {formError}
        </p>
      ) : null}
    </RecordFormSheet>
  );
}
