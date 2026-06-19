"use client";
import { FormInput } from "../../../components/shared/form-input";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { DataTable, DirectoryNameCell } from "../../lib/data-table";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { hasAnyPermission } from "../../lib/permissions";
import { RecordFormSheet } from "../../lib/record-sheet";
import { getSession } from "../../lib/session";
import { TablePanelBody, TablePanelHead, DataTableSection } from "../../lib/table-panel";
import { TableSearchInput } from "../../lib/table-search";
import { zodResolver } from "../../lib/zod-resolver";

type GuardianRow = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
};

const GUARDIANS_PATH = (tenant: string, search: string) => {
  const params = new URLSearchParams({ limit: "100" });
  if (search.trim()) {
    params.set("search", search.trim());
  }
  return `/tenants/${tenant}/students/guardians?${params.toString()}`;
};

export function GuardiansDirectory() {
  const t = useTranslations("guardians");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["student.manage"]);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const guardians = useApiQuery<GuardianRow[]>((tenant) => GUARDIANS_PATH(tenant, search));

  const create = useApiMutation<
    {
      firstName: string;
      lastName: string;
      phone: string;
      relationship: "guardian";
    },
    { id: string }
  >(
    (body, tenant) => ({
      path: `/tenants/${tenant}/students/guardians`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `/tenants/${tenant}/students/guardians`,
        GUARDIANS_PATH(tenant, search)
      ]
    }
  );

  const schema = z.object({
    firstName: z.string().trim().min(1, c("required")),
    lastName: z.string().trim().min(1, c("required")),
    phone: z.string().trim().min(1, c("required"))
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: "", lastName: "", phone: "" }
  });

  const columns: ColumnDef<GuardianRow, unknown>[] = [
    {
      id: "name",
      header: c("name"),
      accessorKey: "fullName",
      cell: ({ row }) => (
        <DirectoryNameCell
          name={row.original.fullName}
          avatar={
            <span className="pds-type-title-xs-bold directory-avatar directory-avatar--guardian">
              <Icon name="supervisor_account" />
            </span>
          }
        />
      )
    },
    { id: "phone", header: t("phone"), accessorFn: (row) => row.phone ?? "—" },
    { id: "email", header: t("email"), accessorFn: (row) => row.email ?? "—" }
  ];

  return (
    <>
      <DataTableSection>
        <TablePanelHead
          title={t("directoryTitle")}
          help={t("directoryHelp")}
          onRefresh={() => void guardians.refetch()}
          onAdd={canManage ? () => setCreateOpen(true) : undefined}
          addLabel={t("addGuardian")}
          extra={
            <TableSearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchGuardians")}
              aria-label={t("searchGuardians")}
            />
          }
        />
        <TablePanelBody
          loading={guardians.isLoading}
          error={guardians.isError ? c("somethingWrong") : null}
          empty={!guardians.data?.length}
        >
          <DataTable
            columns={columns}
            data={guardians.data ?? []}
            getRowHref={(guardian) => `/dashboard/people/guardians/${guardian.id}`}
          />
        </TablePanelBody>
      </DataTableSection>

      <RecordFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t("createTitle")}
        help={t("createHelp")}
        onSubmit={form.handleSubmit(async (values) => {
          await create.mutateAsync({
            firstName: values.firstName,
            lastName: values.lastName,
            phone: values.phone,
            relationship: "guardian"
          });
          form.reset();
          setCreateOpen(false);
        })}
        footer={
          <>
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setCreateOpen(false)}>
              {c("cancel")}
            </button>
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={create.isPending}>
              <Icon name="add" />
              {create.isPending ? c("loading") : t("createGuardian")}
            </button>
          </>
        }
      >
        <Field label={t("firstName")} error={form.formState.errors.firstName?.message}>
          <FormInput {...form.register("firstName")} />
        </Field>
        <Field label={t("lastName")} error={form.formState.errors.lastName?.message}>
          <FormInput {...form.register("lastName")} />
        </Field>
        <Field label={t("phone")} error={form.formState.errors.phone?.message}>
          <FormInput {...form.register("phone")} />
        </Field>
      </RecordFormSheet>
    </>
  );
}