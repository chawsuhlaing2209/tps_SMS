"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { StatusBadge } from "../../../components/shared/badge";
import { ConfirmDialog } from "../../../components/shared/confirm-dialog";
import { RowMoreActionsMenu } from "../../../components/shared/row-more-actions";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { DataTable } from "../../lib/data-table";
import { Icon } from "../../lib/material-icon";
import { hasAnyPermission } from "../../lib/permissions";
import { getSession } from "../../lib/session";
import { DataTableSection, TablePanelBody } from "../../lib/table-panel";
import { toastSuccess } from "../../lib/toast";
import { ModulePageHeader } from "../module-page-header";

type RecycleType =
  | "student"
  | "staff"
  | "grade"
  | "section"
  | "subject"
  | "feeItem"
  | "benefitPackage"
  | "incentiveProgram";

type RecycleItem = {
  type: RecycleType;
  id: string;
  label: string;
  sublabel: string | null;
  archivedAt: string | null;
};

const RECYCLE_BIN_PATH = (tenant: string) => `/tenants/${tenant}/archive/recycle-bin`;

/** Base resource path per record type; restore appends /restore, delete uses it directly. */
const BASE_PATH: Record<RecycleType, (tenant: string, id: string) => string> = {
  student: (t, id) => `/tenants/${t}/students/${id}`,
  staff: (t, id) => `/tenants/${t}/hr/staff/${id}`,
  grade: (t, id) => `/tenants/${t}/academics/grades/${id}`,
  section: (t, id) => `/tenants/${t}/academics/sections/${id}`,
  subject: (t, id) => `/tenants/${t}/academics/subjects/${id}`,
  feeItem: (t, id) => `/tenants/${t}/finance/fee-items/${id}`,
  benefitPackage: (t, id) => `/tenants/${t}/benefit-packages/${id}`,
  incentiveProgram: (t, id) => `/tenants/${t}/incentive-programs/${id}`
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export default function RecycleBinPage() {
  const t = useTranslations("archive");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const permissions = getSession()?.permissions;
  const canView = hasAnyPermission(permissions, [
    "student.manage",
    "hr.manage",
    "academic_setup.manage",
    "finance.manage"
  ]);

  const recycleBin = useApiQuery<{ items: RecycleItem[] }>(canView ? RECYCLE_BIN_PATH : () => null);
  const [pendingDelete, setPendingDelete] = useState<RecycleItem | null>(null);

  const restore = useApiMutation<{ type: RecycleType; id: string }>(
    (body, tenant) => ({
      path: `${BASE_PATH[body.type](tenant, body.id)}/restore`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [RECYCLE_BIN_PATH(tenant)] }
  );
  const remove = useApiMutation<{ type: RecycleType; id: string }>(
    (body, tenant) => ({
      path: BASE_PATH[body.type](tenant, body.id),
      init: { method: "DELETE" }
    }),
    { invalidatePaths: (_b, tenant) => [RECYCLE_BIN_PATH(tenant)] }
  );

  const columns: ColumnDef<RecycleItem, unknown>[] = useMemo(
    () => [
      {
        id: "type",
        header: t("typeColumn"),
        accessorKey: "type",
        cell: ({ row }) => (
          <StatusBadge status="neutral" label={t(`type_${row.original.type}` as "type_student")} />
        )
      },
      {
        id: "label",
        header: c("name"),
        accessorKey: "label",
        cell: ({ row }) => (
          <div className="recycle-bin-name">
            <span className="pds-type-body-s-medium">{row.original.label}</span>
            {row.original.sublabel ? (
              <span className="pds-type-body-s-regular muted"> · {row.original.sublabel}</span>
            ) : null}
          </div>
        )
      },
      {
        id: "archivedAt",
        header: t("archivedAtColumn"),
        accessorFn: (row) => row.archivedAt ?? "",
        cell: ({ row }) => formatDate(row.original.archivedAt)
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
                id: "restore",
                label: c("restore"),
                icon: "restore",
                onSelect: async () => {
                  await restore.mutateAsync({ type: row.original.type, id: row.original.id });
                  toastSuccess(t("restored"));
                }
              },
              {
                id: "delete",
                label: c("deletePermanently"),
                icon: "delete_forever",
                destructive: true,
                onSelect: () => setPendingDelete(row.original)
              }
            ]}
          />
        )
      }
    ],
    [t, c, restore]
  );

  if (!canView) {
    return null;
  }

  const items = recycleBin.data?.items ?? [];

  return (
    <div className="directory-page">
      <ModulePageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: nav("settings") }, { label: t("title") }]}
        actions={
          <button
            type="button"
            className="pds-type-body-m-bold btn-ghost"
            onClick={() => void recycleBin.refetch()}
          >
            <Icon name="refresh" />
            {c("refresh")}
          </button>
        }
      />

      <DataTableSection>
        <TablePanelBody
          loading={recycleBin.isLoading}
          error={recycleBin.isError ? c("somethingWrong") : null}
          empty={!items.length}
          emptyTitle={t("emptyTitle")}
          emptyDescription={t("emptyDescription")}
          emptyIcon="delete"
          unwrapEmpty
        >
          <DataTable columns={columns} data={items} showUpdatedAt={false} />
        </TablePanelBody>
      </DataTableSection>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t("deleteTitle")}
        description={t("deleteHelp", { name: pendingDelete?.label ?? "" })}
        confirmLabel={c("deletePermanently")}
        cancelLabel={c("cancel")}
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await remove.mutateAsync({ type: pendingDelete.type, id: pendingDelete.id });
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
