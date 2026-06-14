"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { usePlatformMutation, usePlatformQuery } from "../../lib/api";
import { DataTable } from "../../lib/data-table";
import { Field } from "../../lib/form";
import { zodResolver } from "../../lib/zod-resolver";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "archived";
  timezone: string;
  defaultLanguage: "en" | "my";
  currency: string;
  subscriptionStatus: string;
  createdAt: string;
};

type CreateTenantResponse = {
  tenant: Tenant;
  owner: { userId: string; email: string; credentialsSent: boolean };
};

type CreateTenantValues = {
  name: string;
  slug: string;
  timezone: string;
  defaultLanguage: "en" | "my";
  currency: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
};

const TENANTS_PATH = "/platform/tenants";

export default function PlatformTenantsPage() {
  const t = useTranslations("platformTenants");
  const c = useTranslations("common");

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const tenants = usePlatformQuery<Tenant[]>(TENANTS_PATH);

  const createTenant = usePlatformMutation<CreateTenantValues, CreateTenantResponse>(
    (body) => ({
      path: TENANTS_PATH,
      init: {
        method: "POST",
        body: JSON.stringify({
          name: body.name,
          slug: body.slug,
          timezone: body.timezone,
          defaultLanguage: body.defaultLanguage,
          currency: body.currency,
          initialOwner: {
            displayName: body.ownerName,
            email: body.ownerEmail,
            ...(body.ownerPassword.trim() ? { password: body.ownerPassword.trim() } : {})
          }
        })
      }
    }),
    { invalidatePaths: [TENANTS_PATH] }
  );

  const schema = z.object({
    name: z.string().trim().min(1, c("required")),
    slug: z
      .string()
      .trim()
      .min(1, c("required"))
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, t("slugInvalid")),
    timezone: z.string().trim().min(1, c("required")),
    defaultLanguage: z.enum(["en", "my"]),
    currency: z.string().trim().min(1, c("required")),
    ownerName: z.string().trim().min(1, c("required")),
    ownerEmail: z.string().trim().email(t("ownerEmailInvalid")),
    ownerPassword: z
      .string()
      .trim()
      .refine((value) => value === "" || value.length >= 10, t("ownerPasswordMin"))
  });

  const form = useForm<CreateTenantValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      slug: "",
      timezone: "Asia/Yangon",
      defaultLanguage: "en",
      currency: "MMK",
      ownerName: "",
      ownerEmail: "",
      ownerPassword: ""
    }
  });

  const watchedName = form.watch("name");
  const watchedSlug = form.watch("slug");

  useEffect(() => {
    if (!watchedName || watchedSlug) {
      return;
    }
    const generated = watchedName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (generated) {
      form.setValue("slug", generated, { shouldValidate: true });
    }
  }, [form, watchedName, watchedSlug]);

  const submit = form.handleSubmit(async (values) => {
    setSuccessMessage(null);
    const result = await createTenant.mutateAsync(values);
    setSuccessMessage(
      t("createSuccess", {
        school: result.tenant.name,
        email: result.owner.email
      })
    );
    form.reset({
      name: "",
      slug: "",
      timezone: "Asia/Yangon",
      defaultLanguage: "en",
      currency: "MMK",
      ownerName: "",
      ownerEmail: "",
      ownerPassword: ""
    });
  });

  const columns: ColumnDef<Tenant, unknown>[] = [
    {
      id: "name",
      header: c("name"),
      cell: ({ row }) => (
        <Link href={`/platform/tenants/${row.original.id}`}>{row.original.name}</Link>
      )
    },
    { id: "slug", header: t("slug"), accessorKey: "slug" },
    {
      id: "status",
      header: c("status"),
      cell: ({ row }) => (
        <span className={`badge badge--${row.original.status}`}>{row.original.status}</span>
      )
    },
    { id: "language", header: t("language"), accessorKey: "defaultLanguage" },
    { id: "currency", header: t("currency"), accessorKey: "currency" }
  ];

  return (
    <div className="page-stack">
      <div className="page-head">
        <h1>{t("title")}</h1>
        <p>{t("description")}</p>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>{t("createTitle")}</h2>
          <button
            type="button"
            className="btn-primary"
            disabled={createTenant.isPending}
            onClick={() => void submit()}
          >
            {createTenant.isPending ? c("adding") : t("createButton")}
          </button>
        </div>
        <p className="muted">{t("createHelp")}</p>
        <form className="entity-form" onSubmit={(event) => void submit(event)}>
          <Field label={c("name")} error={form.formState.errors.name?.message}>
            <input {...form.register("name")} placeholder={t("namePlaceholder")} />
          </Field>
          <Field label={t("slug")} error={form.formState.errors.slug?.message}>
            <input {...form.register("slug")} placeholder={t("slugPlaceholder")} />
          </Field>
          <Field label={t("timezone")} error={form.formState.errors.timezone?.message}>
            <input {...form.register("timezone")} />
          </Field>
          <Field label={t("language")}>
            <select {...form.register("defaultLanguage")}>
              <option value="en">English</option>
              <option value="my">မြန်မာ</option>
            </select>
          </Field>
          <Field label={t("currency")} error={form.formState.errors.currency?.message}>
            <input {...form.register("currency")} />
          </Field>

          <Field label={t("ownerName")} error={form.formState.errors.ownerName?.message}>
            <input {...form.register("ownerName")} placeholder={t("ownerNamePlaceholder")} />
          </Field>
          <Field label={t("ownerEmail")} error={form.formState.errors.ownerEmail?.message}>
            <input
              type="email"
              {...form.register("ownerEmail")}
              placeholder={t("ownerEmailPlaceholder")}
            />
          </Field>
          <Field
            label={t("ownerPassword")}
            error={form.formState.errors.ownerPassword?.message}
          >
            <input
              type="password"
              autoComplete="new-password"
              {...form.register("ownerPassword")}
              placeholder={t("ownerPasswordPlaceholder")}
            />
          </Field>
        </form>
        {successMessage ? (
          <p className="form-feedback form-feedback--ok" role="status">
            {successMessage}
          </p>
        ) : null}
        {createTenant.isError ? (
          <p className="error-text">{createTenant.error.message}</p>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t("listTitle")}</h2>
          <button type="button" className="btn-ghost" onClick={() => void tenants.refetch()}>
            {c("refresh")}
          </button>
        </div>
        {tenants.isLoading ? (
          <p className="muted">{c("loading")}</p>
        ) : tenants.isError ? (
          <p className="error-text">{c("somethingWrong")}</p>
        ) : !tenants.data?.length ? (
          <p className="muted">{c("empty")}</p>
        ) : (
          <DataTable columns={columns} data={tenants.data} />
        )}
      </section>
    </div>
  );
}
