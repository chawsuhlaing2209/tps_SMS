"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Toggle } from "../../../components/shared/toggle";
import { EmptyState } from "../../../components/shared/empty-state";
import { FormField, FormInput, FormTextarea } from "../../../components/shared/form-input";
import { ApiError, useApiMutation, useApiQuery } from "../../lib/api";
import { hasAnyPermission } from "../../lib/permissions";
import { RecordFormSheet } from "../../lib/record-sheet";
import { getSession } from "../../lib/session";
import { Icon } from "../../lib/material-icon";
import { TablePanelBody } from "../../lib/table-panel";
import { zodResolver } from "../../lib/zod-resolver";
import { PageHeader } from "../page-header-context";

type FacilityRoomRow = {
  id: string;
  name: string;
  capacity: number | null;
  note: string | null;
  status: "active" | "inactive";
};

const FACILITY_ROOMS_PATH = (tenant: string) => `/tenants/${tenant}/facility-rooms`;

export default function FacilitiesPage() {
  const t = useTranslations("facilities");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["facility.manage"]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const rooms = useApiQuery<FacilityRoomRow[]>((tenant) =>
    canManage ? FACILITY_ROOMS_PATH(tenant) : null
  );

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, c("required")),
        capacity: z
          .string()
          .refine((value) => !value.trim() || /^\d+$/.test(value.trim()), { message: t("capacityInvalid") })
          .refine((value) => !value.trim() || Number(value.trim()) >= 1, { message: t("capacityMin") }),
        note: z.string()
      }),
    [c, t]
  );

  const form = useForm<{ name: string; capacity: string; note: string }>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", capacity: "", note: "" }
  });

  const createRoom = useApiMutation(
    (body, tenant) => ({
      path: FACILITY_ROOMS_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [FACILITY_ROOMS_PATH(tenant)] }
  );

  const updateRoom = useApiMutation(
    ({ roomId, body }: { roomId: string; body: Record<string, unknown> }, tenant) => ({
      path: `${FACILITY_ROOMS_PATH(tenant)}/${roomId}`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [FACILITY_ROOMS_PATH(tenant)] }
  );

  function openCreate() {
    form.reset({ name: "", capacity: "", note: "" });
    setEditId(null);
    setFormError(null);
    setSheetOpen(true);
  }

  function openEdit(row: FacilityRoomRow) {
    form.reset({
      name: row.name,
      capacity: row.capacity != null ? String(row.capacity) : "",
      note: row.note ?? ""
    });
    setEditId(row.id);
    setFormError(null);
    setSheetOpen(true);
  }

  async function onSubmit(values: { name: string; capacity: string; note: string }) {
    setFormError(null);
    const capacity = values.capacity.trim() ? Number(values.capacity.trim()) : undefined;
    const note = values.note.trim() || undefined;

    try {
      if (editId) {
        await updateRoom.mutateAsync({
          roomId: editId,
          body: {
            name: values.name.trim(),
            capacity: capacity ?? null,
            note: note ?? null
          }
        });
      } else {
        await createRoom.mutateAsync({
          name: values.name.trim(),
          ...(capacity ? { capacity } : {}),
          ...(note ? { note } : {})
        });
      }
      setSheetOpen(false);
      form.reset();
      setEditId(null);
      void rooms.refetch();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
    }
  }

  async function toggleStatus(row: FacilityRoomRow, active: boolean) {
    try {
      await updateRoom.mutateAsync({
        roomId: row.id,
        body: { status: active ? "active" : "inactive" }
      });
      void rooms.refetch();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
    }
  }

  if (!canManage) {
    return <EmptyState icon="lock" title={t("noAccess")} />;
  }

  return (
    <div className="directory-page">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: nav("group_academics") }, { label: nav("facilities") }]}
        actions={
          <>
            <button type="button" className="pds-type-body-m-bold btn-primary" onClick={openCreate}>
              <Icon name="add" />
              {t("addRoom")}
            </button>
          </>
        }
      />

      <TablePanelBody
        variant="plain"
        loading={rooms.isLoading}
        error={rooms.isError ? c("somethingWrong") : null}
        empty={!rooms.data?.length}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
      >
        <div className="padauk-table-wrap">
          <table className="pds-type-body-m-medium padauk-table facility-rooms-table">
            <thead>
              <tr>
                <th className="pds-type-caption-s">{t("name")}</th>
                <th className="pds-type-caption-s padauk-table__num">{t("capacity")}</th>
                <th className="pds-type-caption-s">{t("note")}</th>
                <th className="pds-type-caption-s">{t("active")}</th>
              </tr>
            </thead>
            <tbody>
              {rooms.data?.map((row) => (
                <tr key={row.id} className={row.status === "inactive" ? "facility-rooms-table__row--inactive" : undefined}>
                  <td>
                    <button type="button" className="facility-rooms-table__name" onClick={() => openEdit(row)}>
                      {row.name}
                    </button>
                  </td>
                  <td className="padauk-table__num">{row.capacity ?? "—"}</td>
                  <td className="padauk-table__muted facility-rooms-table__note">
                    {row.note ? row.note : "—"}
                  </td>
                  <td>
                    <Toggle
                      checked={row.status === "active"}
                      onCheckedChange={(checked: boolean) => void toggleStatus(row, checked)}
                      aria-label={t("active")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TablePanelBody>

      <RecordFormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            form.reset();
            setEditId(null);
            setFormError(null);
          }
          setSheetOpen(open);
        }}
        title={editId ? t("editRoom") : t("addRoom")}
        help={t("formHelp")}
        onSubmit={form.handleSubmit((values) => void onSubmit(values))}
        footer={
          <>
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setSheetOpen(false)}>
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="pds-type-body-m-bold btn-primary"
              disabled={createRoom.isPending || updateRoom.isPending}
            >
              {c("save")}
            </button>
          </>
        }
      >
        <FormField label={t("name")} error={form.formState.errors.name?.message}>
          <FormInput {...form.register("name")} />
        </FormField>
        <FormField label={t("capacity")} error={form.formState.errors.capacity?.message} hint={t("capacityHint")}>
          <FormInput {...form.register("capacity")} inputMode="numeric" />
        </FormField>
        <FormField label={t("note")} hint={t("noteHint")}>
          <FormTextarea {...form.register("note")} rows={4} />
        </FormField>
        {formError ? <p className="pds-type-body-m-medium error-text">{formError}</p> : null}
      </RecordFormSheet>
    </div>
  );
}
