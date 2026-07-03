"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FilterTab, FilterTabGroup } from "../../../../components/pds/composites/filter-tabs";
import { PdsSelectField } from "../../../../components/pds";
import { ArchiveVisibilityFilter } from "../../../../components/shared/archive-visibility-filter";
import { StatusBadge } from "../../../../components/shared/badge";
import { ConfirmDialog } from "../../../../components/shared/confirm-dialog";
import { FormField, FormInput, FormTextarea } from "../../../../components/shared/form-input";
import { RowMoreActionsMenu } from "../../../../components/shared/row-more-actions";
import { ApiError, useApiMutation, useApiQuery } from "../../../lib/api";
import { filterByArchiveVisibility, type ArchiveVisibility } from "../../../lib/archive-filter";
import { DataTable } from "../../../lib/data-table";
import { Icon } from "../../../lib/material-icon";
import { moduleBreadcrumbs } from "../../../lib/page-header-utils";
import { hasAnyPermission } from "../../../lib/permissions";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { getSession } from "../../../lib/session";
import { DataTableSection, TablePanelBody } from "../../../lib/table-panel";
import { zodResolver } from "../../../lib/zod-resolver";
import { ModulePageHeader } from "../../module-page-header";

type LeaveType = {
  id: string;
  name: string;
  yearlyQuota: string;
  status: "active" | "archived";
  updatedAt?: string;
};

type LeaveSummaryEntry = {
  leaveTypeId: string;
  name: string;
  allocated: number;
  used: number;
  remaining: number;
  isOverride: boolean;
};

type LeaveRecord = {
  id: string;
  staffId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  days: string;
  note: string | null;
};

type StaffOption = { id: string; fullName: string };

const LEAVES_PATH = (tenant: string) => `/tenants/${tenant}/leaves`;

export default function LeavesPage() {
  const t = useTranslations("leaves");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["leave.manage"]);

  const currentYear = new Date().getFullYear();
  const [tab, setTab] = useState<"types" | "staff">("types");
  const [visibility, setVisibility] = useState<ArchiveVisibility>("active");
  const [typeFormOpen, setTypeFormOpen] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [deletingType, setDeletingType] = useState<LeaveType | null>(null);
  const [staffId, setStaffId] = useState("");
  const [year, setYear] = useState(currentYear);
  const [recordOpen, setRecordOpen] = useState(false);
  const [balancesOpen, setBalancesOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<LeaveRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const types = useApiQuery<LeaveType[]>((tenant) =>
    canManage ? `${LEAVES_PATH(tenant)}/types` : null
  );
  const staffList = useApiQuery<{ data: StaffOption[] }>((tenant) =>
    canManage ? `/tenants/${tenant}/hr/staff?limit=200` : null
  );
  const summary = useApiQuery<LeaveSummaryEntry[]>((tenant) =>
    canManage && staffId ? `${LEAVES_PATH(tenant)}/summary/${staffId}?year=${year}` : null
  );
  const records = useApiQuery<LeaveRecord[]>((tenant) =>
    canManage && staffId ? `${LEAVES_PATH(tenant)}/records?staffId=${staffId}&year=${year}` : null
  );

  const visibleTypes = useMemo(
    () => filterByArchiveVisibility(types.data ?? [], visibility),
    [types.data, visibility]
  );
  const activeTypes = useMemo(
    () => (types.data ?? []).filter((type) => type.status === "active"),
    [types.data]
  );
  const typeName = (id: string) => types.data?.find((type) => type.id === id)?.name ?? id;

  // ── Leave type form ─────────────────────────────────────────────────────────
  const typeSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, c("required")),
        yearlyQuota: z
          .string()
          .refine((value) => /^\d+(\.\d+)?$/.test(value.trim()), { message: t("quotaInvalid") })
      }),
    [c, t]
  );
  const typeForm = useForm<{ name: string; yearlyQuota: string }>({
    resolver: zodResolver(typeSchema),
    defaultValues: { name: "", yearlyQuota: "10" }
  });

  const createType = useApiMutation(
    (body, tenant) => ({
      path: `${LEAVES_PATH(tenant)}/types`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [`${LEAVES_PATH(tenant)}/types`] }
  );
  const updateType = useApiMutation(
    ({ id, ...body }: { id: string } & Record<string, unknown>, tenant) => ({
      path: `${LEAVES_PATH(tenant)}/types/${id}`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [`${LEAVES_PATH(tenant)}/types`] }
  );
  const archiveType = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${LEAVES_PATH(tenant)}/types/${id}/archive`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [`${LEAVES_PATH(tenant)}/types`] }
  );
  const restoreType = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${LEAVES_PATH(tenant)}/types/${id}/restore`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [`${LEAVES_PATH(tenant)}/types`] }
  );
  const deleteType = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${LEAVES_PATH(tenant)}/types/${id}`,
      init: { method: "DELETE" }
    }),
    { invalidatePaths: (_b, tenant) => [`${LEAVES_PATH(tenant)}/types`] }
  );

  // ── Record leave form ───────────────────────────────────────────────────────
  const recordSchema = useMemo(
    () =>
      z.object({
        leaveTypeId: z.string().min(1, c("required")),
        startDate: z.string().min(1, c("required")),
        endDate: z.string().min(1, c("required")),
        days: z
          .string()
          .refine((value) => /^\d+(\.\d+)?$/.test(value.trim()) && Number(value) > 0, {
            message: t("daysInvalid")
          }),
        note: z.string()
      }),
    [c, t]
  );
  const recordForm = useForm<{
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    days: string;
    note: string;
  }>({
    resolver: zodResolver(recordSchema),
    defaultValues: { leaveTypeId: "", startDate: "", endDate: "", days: "1", note: "" }
  });

  const createRecord = useApiMutation(
    (body, tenant) => ({
      path: `${LEAVES_PATH(tenant)}/records`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { showErrorToast: false }
  );
  const deleteRecord = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${LEAVES_PATH(tenant)}/records/${id}`,
      init: { method: "DELETE" }
    })
  );

  // ── Balances form (allocations per type for staff+year) ────────────────────
  const [balancesDraft, setBalancesDraft] = useState<Record<string, string>>({});
  const setBalances = useApiMutation(
    (body, tenant) => ({
      path: `${LEAVES_PATH(tenant)}/balances`,
      init: { method: "PUT", body: JSON.stringify(body) }
    }),
    { showErrorToast: false }
  );

  const typeColumns: ColumnDef<LeaveType, unknown>[] = [
    { id: "name", header: c("name"), accessorKey: "name" },
    {
      id: "quota",
      header: t("yearlyQuota"),
      accessorFn: (row) => Number(row.yearlyQuota),
      cell: ({ row }) => t("daysValue", { count: Number(row.original.yearlyQuota) })
    },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />
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
              id: "edit",
              label: c("edit"),
              icon: "edit",
              onSelect: () => {
                setEditingType(row.original);
                typeForm.reset({
                  name: row.original.name,
                  yearlyQuota: String(Number(row.original.yearlyQuota))
                });
                setFormError(null);
                setTypeFormOpen(true);
              }
            },
            ...(row.original.status === "archived"
              ? [
                  {
                    id: "restore",
                    label: c("restore"),
                    icon: "restore",
                    onSelect: () =>
                      void restoreType.mutateAsync({ id: row.original.id }).then(() => {
                        void types.refetch();
                      })
                  },
                  {
                    id: "delete",
                    label: c("deletePermanently"),
                    icon: "delete_forever",
                    destructive: true,
                    onSelect: () => setDeletingType(row.original)
                  }
                ]
              : [
                  {
                    id: "archive",
                    label: c("archive"),
                    icon: "archive",
                    destructive: true,
                    onSelect: () =>
                      void archiveType.mutateAsync({ id: row.original.id }).then(() => {
                        void types.refetch();
                      })
                  }
                ])
          ]}
        />
      )
    }
  ];

  if (!canManage) {
    return null;
  }

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="directory-page">
      <ModulePageHeader
        navKey="salary"
        title={t("title")}
        description={t("description")}
        breadcrumbs={moduleBreadcrumbs("salary", nav, [{ label: t("title") }])}
        actions={
          tab === "types" ? (
            <>
              <ArchiveVisibilityFilter value={visibility} onChange={setVisibility} />
              <button
                type="button"
                className="pds-type-body-m-bold btn-primary"
                onClick={() => {
                  setEditingType(null);
                  typeForm.reset({ name: "", yearlyQuota: "10" });
                  setFormError(null);
                  setTypeFormOpen(true);
                }}
              >
                <Icon name="add" />
                {t("addType")}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="pds-type-body-m-bold btn-primary"
              disabled={!staffId}
              onClick={() => {
                recordForm.reset({
                  leaveTypeId: activeTypes[0]?.id ?? "",
                  startDate: "",
                  endDate: "",
                  days: "1",
                  note: ""
                });
                setFormError(null);
                setRecordOpen(true);
              }}
            >
              <Icon name="add" />
              {t("recordLeave")}
            </button>
          )
        }
      />

      <div className="benefits-workspace-toolbar">
        <FilterTabGroup aria-label={t("tabsLabel")}>
          <FilterTab
            label={t("tabTypes")}
            active={tab === "types"}
            onClick={() => setTab("types")}
          />
          <FilterTab
            label={t("tabStaff")}
            active={tab === "staff"}
            onClick={() => setTab("staff")}
          />
        </FilterTabGroup>
      </div>

      {tab === "types" ? (
        <DataTableSection>
          <TablePanelBody
            loading={types.isLoading}
            error={types.isError ? c("somethingWrong") : null}
            empty={!visibleTypes.length}
            emptyTitle={t("emptyTypesTitle")}
            emptyDescription={t("emptyTypesDescription")}
            emptyIcon="event_busy"
            unwrapEmpty
          >
            <DataTable columns={typeColumns} data={visibleTypes} />
          </TablePanelBody>
        </DataTableSection>
      ) : (
        <>
          <div className="pds-search-filters-row">
            <div className="pds-search-filters-row__filter--160" style={{ minWidth: 240 }}>
              <PdsSelectField
                variant="filter"
                value={staffId}
                onValueChange={(value) => setStaffId(typeof value === "string" ? value : "")}
                placeholder={t("selectStaff")}
                options={(staffList.data?.data ?? []).map((member) => ({
                  value: member.id,
                  label: member.fullName
                }))}
              />
            </div>
            <div className="pds-search-filters-row__filter--160">
              <PdsSelectField
                variant="filter"
                value={String(year)}
                onValueChange={(value) => {
                  const parsed = Number(value);
                  if (!Number.isNaN(parsed)) setYear(parsed);
                }}
                options={yearOptions.map((option) => ({
                  value: String(option),
                  label: String(option)
                }))}
              />
            </div>
            {staffId ? (
              <button
                type="button"
                className="pds-type-body-m-bold btn-ghost"
                onClick={() => {
                  const draft: Record<string, string> = {};
                  for (const entry of summary.data ?? []) {
                    draft[entry.leaveTypeId] = String(entry.allocated);
                  }
                  setBalancesDraft(draft);
                  setFormError(null);
                  setBalancesOpen(true);
                }}
              >
                <Icon name="tune" />
                {t("editBalances")}
              </button>
            ) : null}
          </div>

          {!staffId ? (
            <TablePanelBody
              empty
              emptyTitle={t("selectStaffTitle")}
              emptyDescription={t("selectStaffHelp")}
              emptyIcon="person_search"
            >
              <span />
            </TablePanelBody>
          ) : (
            <>
              <TablePanelBody
                loading={summary.isLoading}
                error={summary.isError ? c("somethingWrong") : null}
                empty={!summary.data?.length}
                emptyTitle={t("emptyTypesTitle")}
                emptyDescription={t("emptyTypesDescription")}
                emptyIcon="event_busy"
              >
                <table className="pds-type-body-m-medium padauk-table">
                  <thead>
                    <tr>
                      <th className="pds-type-caption-s">{t("leaveType")}</th>
                      <th className="pds-type-caption-s padauk-table__num">{t("allocated")}</th>
                      <th className="pds-type-caption-s padauk-table__num">{t("used")}</th>
                      <th className="pds-type-caption-s padauk-table__num">{t("remaining")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary.data ?? []).map((entry) => (
                      <tr key={entry.leaveTypeId}>
                        <td>{entry.name}</td>
                        <td className="padauk-table__num">
                          {t("daysValue", { count: entry.allocated })}
                        </td>
                        <td className="padauk-table__num">{t("daysValue", { count: entry.used })}</td>
                        <td className="padauk-table__num">
                          <strong>{t("daysValue", { count: entry.remaining })}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TablePanelBody>

              <TablePanelBody
                loading={records.isLoading}
                error={records.isError ? c("somethingWrong") : null}
                empty={!records.data?.length}
                emptyTitle={t("emptyRecordsTitle")}
                emptyDescription={t("emptyRecordsDescription")}
                emptyIcon="history"
              >
                <table className="pds-type-body-m-medium padauk-table padauk-table--pinned-end">
                  <thead>
                    <tr>
                      <th className="pds-type-caption-s">{t("leaveType")}</th>
                      <th className="pds-type-caption-s">{t("dates")}</th>
                      <th className="pds-type-caption-s padauk-table__num">{t("days")}</th>
                      <th className="pds-type-caption-s">{t("note")}</th>
                      <th className="pds-type-caption-s" aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {(records.data ?? []).map((record) => (
                      <tr key={record.id}>
                        <td>{typeName(record.leaveTypeId)}</td>
                        <td>
                          {record.startDate}
                          {record.endDate !== record.startDate ? ` → ${record.endDate}` : ""}
                        </td>
                        <td className="padauk-table__num">
                          {t("daysValue", { count: Number(record.days) })}
                        </td>
                        <td className="padauk-table__muted">{record.note ?? "—"}</td>
                        <td className="padauk-table__actions">
                          <RowMoreActionsMenu
                            ariaLabel={c("moreActions")}
                            items={[
                              {
                                id: "delete",
                                label: c("delete"),
                                icon: "delete",
                                destructive: true,
                                onSelect: () => setDeletingRecord(record)
                              }
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TablePanelBody>
            </>
          )}
        </>
      )}

      <RecordFormSheet
        open={typeFormOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditingType(null);
            setFormError(null);
          }
          setTypeFormOpen(open);
        }}
        title={editingType ? t("editType") : t("addType")}
        help={t("typeFormHelp")}
        onSubmit={typeForm.handleSubmit(async (values) => {
          setFormError(null);
          try {
            if (editingType) {
              await updateType.mutateAsync({
                id: editingType.id,
                name: values.name.trim(),
                yearlyQuota: Number(values.yearlyQuota)
              });
            } else {
              await createType.mutateAsync({
                name: values.name.trim(),
                yearlyQuota: Number(values.yearlyQuota)
              });
            }
            setTypeFormOpen(false);
            setEditingType(null);
            void types.refetch();
          } catch (error) {
            setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
          }
        })}
        footer={
          <>
            <button
              type="button"
              className="pds-type-body-m-bold btn-ghost"
              onClick={() => setTypeFormOpen(false)}
            >
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="pds-type-body-m-bold btn-primary"
              disabled={createType.isPending || updateType.isPending}
            >
              {c("save")}
            </button>
          </>
        }
      >
        <FormField label={c("name")} error={typeForm.formState.errors.name?.message}>
          <FormInput {...typeForm.register("name")} />
        </FormField>
        <FormField
          label={t("yearlyQuota")}
          hint={t("yearlyQuotaHint")}
          error={typeForm.formState.errors.yearlyQuota?.message}
        >
          <FormInput inputMode="decimal" {...typeForm.register("yearlyQuota")} />
        </FormField>
        {formError ? <p className="pds-type-body-m-medium error-text">{formError}</p> : null}
      </RecordFormSheet>

      <RecordFormSheet
        open={recordOpen}
        onOpenChange={(open) => {
          if (!open) setFormError(null);
          setRecordOpen(open);
        }}
        title={t("recordLeave")}
        help={t("recordLeaveHelp")}
        onSubmit={recordForm.handleSubmit(async (values) => {
          setFormError(null);
          try {
            await createRecord.mutateAsync({
              staffId,
              leaveTypeId: values.leaveTypeId,
              startDate: values.startDate,
              endDate: values.endDate || values.startDate,
              days: Number(values.days),
              note: values.note.trim() || undefined
            });
            setRecordOpen(false);
            void summary.refetch();
            void records.refetch();
          } catch (error) {
            setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
          }
        })}
        footer={
          <>
            <button
              type="button"
              className="pds-type-body-m-bold btn-ghost"
              onClick={() => setRecordOpen(false)}
            >
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="pds-type-body-m-bold btn-primary"
              disabled={createRecord.isPending}
            >
              {c("save")}
            </button>
          </>
        }
      >
        <FormField label={t("leaveType")} error={recordForm.formState.errors.leaveTypeId?.message}>
          <PdsSelectField
            variant="form"
            value={recordForm.watch("leaveTypeId")}
            onValueChange={(value) => {
              if (typeof value === "string") recordForm.setValue("leaveTypeId", value);
            }}
            options={activeTypes.map((type) => ({ value: type.id, label: type.name }))}
          />
        </FormField>
        <FormField label={t("startDate")} error={recordForm.formState.errors.startDate?.message}>
          <FormInput type="date" {...recordForm.register("startDate")} />
        </FormField>
        <FormField label={t("endDate")} error={recordForm.formState.errors.endDate?.message}>
          <FormInput type="date" {...recordForm.register("endDate")} />
        </FormField>
        <FormField
          label={t("days")}
          hint={t("daysHint")}
          error={recordForm.formState.errors.days?.message}
        >
          <FormInput inputMode="decimal" {...recordForm.register("days")} />
        </FormField>
        <FormField label={t("note")}>
          <FormTextarea rows={3} {...recordForm.register("note")} />
        </FormField>
        {formError ? <p className="pds-type-body-m-medium error-text">{formError}</p> : null}
      </RecordFormSheet>

      <RecordFormSheet
        open={balancesOpen}
        onOpenChange={(open) => {
          if (!open) setFormError(null);
          setBalancesOpen(open);
        }}
        title={t("editBalances")}
        help={t("editBalancesHelp", { year })}
        onSubmit={async (event) => {
          event.preventDefault();
          setFormError(null);
          try {
            await setBalances.mutateAsync({
              staffId,
              calendarYear: year,
              entries: Object.entries(balancesDraft)
                .filter(([, value]) => /^\d+(\.\d+)?$/.test(value.trim()))
                .map(([leaveTypeId, value]) => ({
                  leaveTypeId,
                  allocatedDays: Number(value)
                }))
            });
            setBalancesOpen(false);
            void summary.refetch();
          } catch (error) {
            setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
          }
        }}
        footer={
          <>
            <button
              type="button"
              className="pds-type-body-m-bold btn-ghost"
              onClick={() => setBalancesOpen(false)}
            >
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="pds-type-body-m-bold btn-primary"
              disabled={setBalances.isPending}
            >
              {c("save")}
            </button>
          </>
        }
      >
        {(summary.data ?? []).map((entry) => (
          <FormField key={entry.leaveTypeId} label={entry.name}>
            <FormInput
              inputMode="decimal"
              value={balancesDraft[entry.leaveTypeId] ?? ""}
              onChange={(event) =>
                setBalancesDraft((prev) => ({
                  ...prev,
                  [entry.leaveTypeId]: event.target.value
                }))
              }
            />
          </FormField>
        ))}
        {formError ? <p className="pds-type-body-m-medium error-text">{formError}</p> : null}
      </RecordFormSheet>

      <ConfirmDialog
        open={deletingType !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingType(null);
        }}
        title={t("deleteTypeTitle")}
        description={t("deleteTypeHelp", { name: deletingType?.name ?? "" })}
        confirmLabel={c("deletePermanently")}
        cancelLabel={c("cancel")}
        destructive
        loading={deleteType.isPending}
        onConfirm={async () => {
          if (!deletingType) return;
          await deleteType.mutateAsync({ id: deletingType.id });
          setDeletingType(null);
          void types.refetch();
        }}
      />

      <ConfirmDialog
        open={deletingRecord !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingRecord(null);
        }}
        title={t("deleteRecordTitle")}
        description={t("deleteRecordHelp")}
        confirmLabel={c("delete")}
        cancelLabel={c("cancel")}
        destructive
        loading={deleteRecord.isPending}
        onConfirm={async () => {
          if (!deletingRecord) return;
          await deleteRecord.mutateAsync({ id: deletingRecord.id });
          setDeletingRecord(null);
          void summary.refetch();
          void records.refetch();
        }}
      />
    </div>
  );
}
