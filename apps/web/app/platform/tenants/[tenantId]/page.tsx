"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { featureFlags as allFeatureFlagKeys } from "@sms/shared";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { usePlatformMutation, usePlatformQuery } from "../../../lib/api";
import { DataTable } from "../../../lib/data-table";
import { Field } from "../../../lib/form";
import { zodResolver } from "../../../lib/zod-resolver";
import { StatusBadge } from "../../../../components/shared/badge";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "archived";
  timezone: string;
  defaultLanguage: "en" | "my";
  currency: string;
  subscriptionStatus: string;
};

type TenantSettings = {
  tenantId: string;
  schoolName: string;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  receiptPrefix: string;
  invoicePrefix: string;
};

type FeatureFlagRow = {
  id: string;
  tenantId: string;
  key: string;
  enabled: boolean;
};

type SettingsValues = {
  schoolName: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  receiptPrefix: string;
  invoicePrefix: string;
};

type SaveSettingsBody = {
  schoolName: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  receiptPrefix?: string;
  invoicePrefix?: string;
};

const TENANTS_PATH = "/platform/tenants";

export default function TenantDetailPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const t = useTranslations("platformTenants");
  const c = useTranslations("common");
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const tenants = usePlatformQuery<Tenant[]>(TENANTS_PATH);
  const tenant = tenants.data?.find((row) => row.id === tenantId);

  const settingsPath = `${TENANTS_PATH}/${tenantId}/settings`;
  const flagsPath = `${TENANTS_PATH}/${tenantId}/feature-flags`;

  const settings = usePlatformQuery<TenantSettings>(settingsPath);
  const flags = usePlatformQuery<FeatureFlagRow[]>(flagsPath);

  const updateStatus = usePlatformMutation<{ status: Tenant["status"] }>(
    (body) => ({
      path: `${TENANTS_PATH}/${tenantId}/status`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    { invalidatePaths: [TENANTS_PATH] }
  );

  const saveSettings = usePlatformMutation<SaveSettingsBody>(
    (body) => ({
      path: settingsPath,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: [settingsPath] }
  );

  const toggleFlag = usePlatformMutation<{ key: string; enabled: boolean }>(
    (body) => ({
      path: flagsPath,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: [flagsPath] }
  );

  const settingsSchema = z.object({
    schoolName: z.string().trim().min(1, c("required")),
    address: z.string().trim(),
    contactEmail: z.string().trim().email().or(z.literal("")),
    contactPhone: z.string().trim(),
    receiptPrefix: z.string().trim(),
    invoicePrefix: z.string().trim()
  });

  const settingsForm = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    values: {
      schoolName: settings.data?.schoolName ?? "",
      address: settings.data?.address ?? "",
      contactEmail: settings.data?.contactEmail ?? "",
      contactPhone: settings.data?.contactPhone ?? "",
      receiptPrefix: settings.data?.receiptPrefix ?? "RCPT",
      invoicePrefix: settings.data?.invoicePrefix ?? "INV"
    }
  });

  const submitSettings = settingsForm.handleSubmit(async (values) => {
    setSettingsSaved(false);
    await saveSettings.mutateAsync({
      schoolName: values.schoolName,
      ...(values.address ? { address: values.address } : {}),
      ...(values.contactEmail ? { contactEmail: values.contactEmail } : {}),
      ...(values.contactPhone ? { contactPhone: values.contactPhone } : {}),
      ...(values.receiptPrefix ? { receiptPrefix: values.receiptPrefix } : {}),
      ...(values.invoicePrefix ? { invoicePrefix: values.invoicePrefix } : {})
    });
    setSettingsSaved(true);
  });

  async function changeStatus(status: Tenant["status"]) {
    setStatusMessage(null);
    await updateStatus.mutateAsync({ status });
    setStatusMessage(t("statusUpdated", { status: t(`status_${status}`) }));
  }

  const flagState = new Map(flags.data?.map((row) => [row.key, row.enabled]) ?? []);

  const flagColumns: ColumnDef<{ key: string; enabled: boolean }, unknown>[] = [
    { id: "key", header: t("flagKey"), accessorKey: "key" },
    {
      id: "enabled",
      header: t("flagEnabled"),
      cell: ({ row }) => (
        <button
          type="button"
          className={row.original.enabled ? "badge badge--tone-success" : "badge badge--tone-neutral"}
          disabled={toggleFlag.isPending}
          onClick={() =>
            void toggleFlag.mutateAsync({ key: row.original.key, enabled: !row.original.enabled })
          }
        >
          {row.original.enabled ? c("yes") : c("no")}
        </button>
      )
    }
  ];

  const flagRows = allFeatureFlagKeys.map((key) => ({
    key,
    enabled: flagState.get(key) ?? false
  }));

  if (tenants.isLoading) {
    return <p className="muted">{c("loading")}</p>;
  }

  if (!tenant) {
    return (
      <div className="page-stack">
        <p className="error-text">{t("tenantNotFound")}</p>
        <Link href="/platform/tenants">{t("backToList")}</Link>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="page-head">
        <Link href="/platform/tenants" className="muted">
          {t("backToList")}
        </Link>
        <h1>
          {tenant.name}{" "}
          <StatusBadge status={tenant.status} label={t(`status_${tenant.status}`)} />
        </h1>
        <p>
          <code>{tenant.slug}</code> · {tenant.timezone} · {tenant.currency}
        </p>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>{c("status")}</h2>
        </div>
        <div className="entity-form" style={{ flexDirection: "row", gap: "8px", flexWrap: "wrap" }}>
          {(["active", "suspended", "archived"] as const).map((status) => (
            <button
              key={status}
              type="button"
              className={tenant.status === status ? "btn-primary" : "btn-ghost"}
              disabled={updateStatus.isPending || tenant.status === status}
              onClick={() => void changeStatus(status)}
            >
              {t(`status_${status}`)}
            </button>
          ))}
        </div>
        {statusMessage ? (
          <p className="form-feedback form-feedback--ok" role="status">
            {statusMessage}
          </p>
        ) : null}
        {updateStatus.isError ? (
          <p className="error-text">{updateStatus.error.message}</p>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t("settingsTitle")}</h2>
          <button
            type="button"
            className="btn-primary"
            disabled={saveSettings.isPending || settings.isLoading}
            onClick={() => void submitSettings()}
          >
            {saveSettings.isPending ? c("loading") : t("saveSettings")}
          </button>
        </div>
        {settings.isLoading ? (
          <p className="muted">{c("loading")}</p>
        ) : (
          <form className="entity-form" onSubmit={(event) => void submitSettings(event)}>
            <Field label={t("schoolName")} error={settingsForm.formState.errors.schoolName?.message}>
              <input {...settingsForm.register("schoolName")} />
            </Field>
            <Field label={t("contactEmail")} error={settingsForm.formState.errors.contactEmail?.message}>
              <input {...settingsForm.register("contactEmail")} />
            </Field>
            <Field label={t("contactPhone")}>
              <input {...settingsForm.register("contactPhone")} />
            </Field>
            <Field label={t("address")}>
              <input {...settingsForm.register("address")} />
            </Field>
            <Field label={t("receiptPrefix")}>
              <input {...settingsForm.register("receiptPrefix")} />
            </Field>
            <Field label={t("invoicePrefix")}>
              <input {...settingsForm.register("invoicePrefix")} />
            </Field>
          </form>
        )}
        {settingsSaved ? (
          <p className="form-feedback form-feedback--ok" role="status">
            {t("settingsSaved")}
          </p>
        ) : null}
        {saveSettings.isError ? (
          <p className="error-text">{saveSettings.error.message}</p>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t("featuresTitle")}</h2>
        </div>
        <p className="muted">{t("featuresHelp")}</p>
        {flags.isLoading ? (
          <p className="muted">{c("loading")}</p>
        ) : (
          <DataTable columns={flagColumns} data={flagRows} />
        )}
      </section>
    </div>
  );
}
