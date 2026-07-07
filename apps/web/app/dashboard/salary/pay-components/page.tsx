"use client";

import { ArchiveVisibilityFilter } from "../../../../components/shared/archive-visibility-filter";
import { StatusBadge } from "../../../../components/shared/badge";
import { ConfirmDialog } from "../../../../components/shared/confirm-dialog";
import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { filterByArchiveVisibility, isArchivedRecord, type ArchiveVisibility } from "../../../lib/archive-filter";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { DataTable } from "../../../lib/data-table";
import { Icon } from "../../../lib/material-icon";
import { hasAnyPermission } from "../../../lib/permissions";
import { getSession } from "../../../lib/session";
import { DataTableSection, TablePanelBody } from "../../../lib/table-panel";
import { ModulePageHeader } from "../../module-page-header";
import {
  PayComponentFormSheet,
  type PayComponentRecord
} from "../benefits/pay-component-form-sheet";

const PAY_COMPONENTS_PATH = (tenant: string) => `/tenants/${tenant}/pay-components`;

/** Bare formatted number — the awardFixedValue message supplies the "MMK". */
function formatMoney(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function formatDefaultAmount(
  component: PayComponentRecord,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  const amount = Number(component.defaultAmount) || 0;
  if (component.calculation === "percent_of_basic") {
    return t("awardPercentValue", { percent: amount });
  }
  return t("awardFixedValue", { amount: formatMoney(amount) });
}

export default function PayComponentsPage() {
  const t = useTranslations("salary");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["salary.manage"]);

  const [componentFormOpen, setComponentFormOpen] = useState(false);
  const [componentFormMode, setComponentFormMode] = useState<"create" | "edit">("create");
  const [editingComponent, setEditingComponent] = useState<PayComponentRecord | null>(null);
  const [archiveVisibility, setArchiveVisibility] = useState<ArchiveVisibility>("active");
  const [deletingComponent, setDeletingComponent] = useState<PayComponentRecord | null>(null);
  const [reactivatingComponent, setReactivatingComponent] = useState<PayComponentRecord | null>(null);

  const payComponents = useApiQuery<PayComponentRecord[]>(
    canManage ? PAY_COMPONENTS_PATH : () => null
  );

  const filteredPayComponents = useMemo(
    () =>
      filterByArchiveVisibility(payComponents.data ?? [], archiveVisibility).filter(
        // MVP-1: this page manages deductions only; legacy earning components
        // stay in the DB for payroll history but are hidden here.
        (component) => component.kind === "deduction"
      ),
    [payComponents.data, archiveVisibility]
  );

  const createPayComponent = useApiMutation<Record<string, unknown>>(
    (body, tenant) => ({
      path: PAY_COMPONENTS_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [PAY_COMPONENTS_PATH(tenant)] }
  );

  const updatePayComponent = useApiMutation<{ id: string } & Record<string, unknown>>(
    ({ id, ...body }, tenant) => ({
      path: `${PAY_COMPONENTS_PATH(tenant)}/${id}`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [PAY_COMPONENTS_PATH(tenant)] }
  );

  const archivePayComponent = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${PAY_COMPONENTS_PATH(tenant)}/${id}/archive`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [PAY_COMPONENTS_PATH(tenant)] }
  );

  const reactivatePayComponent = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${PAY_COMPONENTS_PATH(tenant)}/${id}/restore`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [PAY_COMPONENTS_PATH(tenant)] }
  );

  const deletePayComponent = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${PAY_COMPONENTS_PATH(tenant)}/${id}`,
      init: { method: "DELETE" }
    }),
    { invalidatePaths: (_b, tenant) => [PAY_COMPONENTS_PATH(tenant)] }
  );

  const openComponentForm = (mode: "create" | "edit", record?: PayComponentRecord | null) => {
    setComponentFormMode(mode);
    setEditingComponent(record ?? null);
    setComponentFormOpen(true);
  };

  const payComponentColumns: ColumnDef<PayComponentRecord, unknown>[] = [
    {
      id: "name",
      header: c("name"),
      accessorKey: "name",
      cell: ({ row }) => <span className="pds-type-body-m-bold">{row.original.name}</span>
    },
    {
      id: "code",
      header: t("codeLabel"),
      accessorKey: "code",
      cell: ({ row }) => <span className="pds-type-body-s-regular muted">{row.original.code}</span>
    },
    {
      id: "kind",
      header: t("kindLabel"),
      accessorKey: "kind",
      cell: ({ row }) => t(`kind.${row.original.kind}` as "kind.earning")
    },
    {
      id: "calculation",
      header: t("calculationLabel"),
      accessorKey: "calculation",
      cell: ({ row }) => t(`calculation.${row.original.calculation}` as "calculation.fixed")
    },
    {
      id: "defaultAmount",
      header: t("amount"),
      cell: ({ row }) => formatDefaultAmount(row.original, t)
    },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status}
          label={t(`status.${row.original.status}` as "status.active")}
        />
      )
    },
    {
      id: "actions",
      header: c("actions"),
      enableSorting: false,
      cell: ({ row }) => {
        const archived = isArchivedRecord(row.original.status);

        return (
        <div style={{ display: "flex", gap: "var(--pds-gap-small)" }}>
          {archived ? (
            <>
              <button
                type="button"
                className="pds-type-body-s-regular row-action"
                disabled={reactivatePayComponent.isPending}
                onClick={(event) => {
                  event.stopPropagation();
                  setReactivatingComponent(row.original);
                }}
              >
                {c("reactivate")}
              </button>
              <button
                type="button"
                className="pds-type-body-s-regular row-action row-action--danger"
                disabled={deletePayComponent.isPending}
                onClick={(event) => {
                  event.stopPropagation();
                  setDeletingComponent(row.original);
                }}
              >
                {c("delete")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="pds-type-body-s-regular row-action"
                onClick={(event) => {
                  event.stopPropagation();
                  openComponentForm("edit", row.original);
                }}
              >
                {c("edit")}
              </button>
              <button
                type="button"
                className="pds-type-body-s-regular row-action"
                disabled={archivePayComponent.isPending}
                onClick={(event) => {
                  event.stopPropagation();
                  void archivePayComponent.mutateAsync({ id: row.original.id }).then(() => {
                    void payComponents.refetch();
                  });
                }}
              >
                {c("archive")}
              </button>
            </>
          )}
        </div>
        );
      }
    }
  ];

  if (!canManage) {
    return null;
  }

  return (
    <div className="directory-page pay-components-page">
      <ModulePageHeader
        navKey="deductions"
        title={t("payComponentsTitle")}
        description={t("payComponentsDescription")}
      />

      <div className="benefits-workspace-toolbar benefits-workspace-toolbar--end">
        <ArchiveVisibilityFilter value={archiveVisibility} onChange={setArchiveVisibility} />
        <button
          type="button"
          className="pds-type-body-m-bold btn-primary"
          onClick={() => openComponentForm("create")}
        >
          <Icon name="add" />
          {t("addComponent")}
        </button>
      </div>

      <DataTableSection>
        <TablePanelBody
          loading={payComponents.isLoading}
          error={payComponents.isError ? c("somethingWrong") : null}
          empty={!filteredPayComponents.length}
          emptyTitle={t("emptyPayComponentsTitle")}
          emptyDescription={t("emptyPayComponentsDescription")}
          emptyIcon="payments"
          unwrapEmpty
        >
          <DataTable
            columns={payComponentColumns}
            data={filteredPayComponents}
            onRowClick={(row) => {
              if (isArchivedRecord(row.status)) {
                return;
              }
              openComponentForm("edit", row);
            }}
          />
        </TablePanelBody>
      </DataTableSection>

      <PayComponentFormSheet
        open={componentFormOpen}
        onOpenChange={setComponentFormOpen}
        mode={componentFormMode}
        record={editingComponent}
        submitting={createPayComponent.isPending || updatePayComponent.isPending}
        archiving={archivePayComponent.isPending || reactivatePayComponent.isPending}
        onSubmit={async (values) => {
          if (componentFormMode === "edit" && editingComponent) {
            await updatePayComponent.mutateAsync({ id: editingComponent.id, ...values });
          } else {
            await createPayComponent.mutateAsync(values);
          }
          setComponentFormOpen(false);
          void payComponents.refetch();
        }}
        onArchive={
          editingComponent
            ? async () => {
                await archivePayComponent.mutateAsync({ id: editingComponent.id });
                setComponentFormOpen(false);
                void payComponents.refetch();
              }
            : undefined
        }
        onReactivate={
          editingComponent
            ? async () => {
                await reactivatePayComponent.mutateAsync({ id: editingComponent.id });
                setComponentFormOpen(false);
                void payComponents.refetch();
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={reactivatingComponent !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReactivatingComponent(null);
          }
        }}
        title={t("reactivatePayComponentTitle")}
        description={t("reactivatePayComponentHelp", { name: reactivatingComponent?.name ?? "" })}
        confirmLabel={c("reactivate")}
        cancelLabel={c("cancel")}
        loading={reactivatePayComponent.isPending}
        onConfirm={() => {
          if (!reactivatingComponent) {
            return;
          }
          void reactivatePayComponent.mutateAsync({ id: reactivatingComponent.id }).then(() => {
            setReactivatingComponent(null);
            void payComponents.refetch();
          });
        }}
      />

      <ConfirmDialog
        open={deletingComponent !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingComponent(null);
          }
        }}
        title={t("deletePayComponentTitle")}
        description={t("deletePayComponentHelp", { name: deletingComponent?.name ?? "" })}
        confirmLabel={c("delete")}
        cancelLabel={c("cancel")}
        destructive
        loading={deletePayComponent.isPending}
        onConfirm={() => {
          if (!deletingComponent) {
            return;
          }
          void deletePayComponent.mutateAsync({ id: deletingComponent.id }).then(() => {
            setDeletingComponent(null);
            void payComponents.refetch();
          });
        }}
      />
    </div>
  );
}
