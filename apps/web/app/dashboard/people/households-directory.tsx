"use client";
import { FormInput } from "../../../components/shared/form-input";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { RowMoreActionsMenu } from "../../../components/shared/row-more-actions";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PdsSearchBar, PdsSearchFiltersRow, PdsSelectField } from "../../../components/pds";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { DataTable, DirectoryMemberCell } from "../../lib/data-table";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { hasAnyPermission } from "../../lib/permissions";
import { RecordFormSheet } from "../../lib/record-sheet";
import { getSession } from "../../lib/session";
import { TablePanelBody, DataTableSection } from "../../lib/table-panel";
import { zodResolver } from "../../lib/zod-resolver";
import { usePeopleDirectoryActions } from "./people-directory-actions";
import { peopleDirectoryCountsPath } from "./people-directory-counts";

type GuardianOption = { id: string; fullName: string; phone: string | null };

type HouseholdRow = {
  id: string;
  name: string;
  primaryGuardianName: string | null;
  memberCount: number;
  updatedAt?: string;
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
  const { householdCreateOpen, setHouseholdCreateOpen } = usePeopleDirectoryActions();
  const [search, setSearch] = useState("");

  const households = useApiQuery<HouseholdList>((tenant) => HOUSEHOLDS_PATH(tenant, search));
  const guardians = useApiQuery<GuardianOption[]>((tenant) =>
    householdCreateOpen ? `/tenants/${tenant}/students/guardians?limit=200` : null
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
        HOUSEHOLDS_PATH(tenant, search),
        peopleDirectoryCountsPath(tenant)
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
      cell: ({ row }) => <DirectoryMemberCell name={row.original.name} colorKey={row.original.id} />
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
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <RowMoreActionsMenu
          ariaLabel={c("moreActions")}
          items={[
            {
              id: "view",
              label: c("view"),
              icon: "visibility",
              onSelect: () => {
                window.location.href = `/dashboard/people/households/${row.original.id}`;
              }
            }
          ]}
        />
      )
    } satisfies ColumnDef<HouseholdRow, unknown>
  ];

  return (
    <>
      <DataTableSection>
        <PdsSearchFiltersRow
          filters={
            <PdsSearchBar
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchHouseholds")}
              aria-label={t("searchHouseholds")}
            />
          }
        />

        <TablePanelBody
          variant="card-plain"
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
      </DataTableSection>

      {canManage ? (
        <RecordFormSheet
          open={householdCreateOpen}
          onOpenChange={setHouseholdCreateOpen}
          title={t("createTitle")}
          help={t("createHelp")}
          onSubmit={form.handleSubmit(async (values) => {
            const created = await create.mutateAsync(values);
            form.reset();
            setHouseholdCreateOpen(false);
            router.push(`/dashboard/people/households/${created.id}`);
          })}
          footer={
            <>
              <button
                type="button"
                className="pds-type-body-m-bold btn-ghost"
                onClick={() => setHouseholdCreateOpen(false)}
              >
                {c("cancel")}
              </button>
              <button
                type="submit"
                className="pds-type-body-m-bold btn-primary"
                disabled={create.isPending}
              >
                <Icon name="add" />
                {create.isPending ? c("loading") : t("createHousehold")}
              </button>
            </>
          }
        >
          <Field label={t("householdName")} error={form.formState.errors.name?.message}>
            <FormInput {...form.register("name")} placeholder={t("householdNamePlaceholder")} />
          </Field>
          <Field label={t("primaryGuardian")} error={form.formState.errors.primaryGuardianId?.message}>
            <PdsSelectField
              variant="form"
              value={form.watch("primaryGuardianId")}
              onValueChange={(value) =>
                form.setValue("primaryGuardianId", typeof value === "string" ? value : "", {
                  shouldValidate: true
                })
              }
              placeholder={t("selectPrimaryGuardian")}
              options={(guardians.data ?? []).map((guardian) => ({
                value: guardian.id,
                label: `${guardian.fullName}${guardian.phone ? ` (${guardian.phone})` : ""}`
              }))}
            />
          </Field>
        </RecordFormSheet>
      ) : null}
    </>
  );
}
