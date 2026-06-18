"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { DataTable, DirectoryNameCell } from "../../lib/data-table";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/icon";
import { hasAnyPermission } from "../../lib/permissions";
import { RecordFormSheet } from "../../lib/record-sheet";
import { getSession } from "../../lib/session";
import { TablePanelBody, TablePanelHead } from "../../lib/table-panel";
import { TableSearchInput } from "../../lib/table-search";
import { zodResolver } from "../../lib/zod-resolver";

type GuardianOption = { id: string; fullName: string; phone: string | null };

type HouseholdRow = {
  id: string;
  name: string;
  primaryGuardianName: string | null;
  memberCount: number;
};

type HouseholdList = { data: HouseholdRow[]; total: number };

const HOUSEHOLDS_PATH = (tenant: string, search: string) => {
  const params = new URLSearchParams({ limit: "100" });
  if (search.trim()) {
    params.set("search", search.trim());
  }
  return `/tenants/${tenant}/family-groups?${params.toString()}`;
};

export function HouseholdsDirectory() {
  const t = useTranslations("households");
  const c = useTranslations("common");
  const router = useRouter();
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["student.manage"]);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const households = useApiQuery<HouseholdList>((tenant) => HOUSEHOLDS_PATH(tenant, search));
  const guardians = useApiQuery<GuardianOption[]>((tenant) =>
    createOpen ? `/tenants/${tenant}/students/guardians?limit=200` : null
  );

  const create = useApiMutation<
    { name: string; primaryGuardianId: string },
    { id: string }
  >(
    (body, tenant) => ({
      path: `/tenants/${tenant}/family-groups`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `/tenants/${tenant}/family-groups`,
        HOUSEHOLDS_PATH(tenant, search)
      ]
    }
  );

  const schema = z.object({
    name: z.string().trim().min(1, c("required")),
    primaryGuardianId: z.string().uuid(c("required"))
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", primaryGuardianId: "" }
  });

  const columns: ColumnDef<HouseholdRow, unknown>[] = [
    {
      id: "name",
      header: t("householdName"),
      accessorKey: "name",
      cell: ({ row }) => (
        <DirectoryNameCell
          name={row.original.name}
          avatar={
            <span className="directory-avatar directory-avatar--household">
              <Icon name="family_restroom" />
            </span>
          }
        />
      )
    },
    {
      id: "guardian",
      header: t("primaryGuardian"),
      accessorFn: (row) => row.primaryGuardianName ?? "—"
    },
    {
      id: "members",
      header: t("memberCount"),
      accessorFn: (row) => row.memberCount
    }
  ];

  return (
    <>
      <section className="panel">
        <TablePanelHead
          title={t("directoryTitle")}
          help={t("directoryHelp")}
          onRefresh={() => void households.refetch()}
          onAdd={canManage ? () => setCreateOpen(true) : undefined}
          addLabel={t("addHousehold")}
          extra={
            <TableSearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchHouseholds")}
              aria-label={t("searchHouseholds")}
            />
          }
        />
        <TablePanelBody
          loading={households.isLoading}
          error={households.isError ? c("somethingWrong") : null}
          empty={!households.data?.data.length}
        >
          <DataTable
            columns={columns}
            data={households.data?.data ?? []}
            getRowHref={(household) => `/dashboard/people/households/${household.id}`}
          />
        </TablePanelBody>
      </section>

      <RecordFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t("createTitle")}
        help={t("createHelp")}
        onSubmit={form.handleSubmit(async (values) => {
          const created = await create.mutateAsync(values);
          form.reset();
          setCreateOpen(false);
          router.push(`/dashboard/people/households/${created.id}`);
        })}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)}>
              {c("cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              <Icon name="add" />
              {create.isPending ? c("loading") : t("createHousehold")}
            </button>
          </>
        }
      >
        <Field label={t("householdName")} error={form.formState.errors.name?.message}>
          <input {...form.register("name")} placeholder={t("householdNamePlaceholder")} />
        </Field>
        <Field label={t("primaryGuardian")} error={form.formState.errors.primaryGuardianId?.message}>
          <select {...form.register("primaryGuardianId")}>
            <option value="">{t("selectPrimaryGuardian")}</option>
            {(guardians.data ?? []).map((guardian) => (
              <option key={guardian.id} value={guardian.id}>
                {guardian.fullName}
                {guardian.phone ? ` (${guardian.phone})` : ""}
              </option>
            ))}
          </select>
        </Field>
      </RecordFormSheet>
    </>
  );
}
