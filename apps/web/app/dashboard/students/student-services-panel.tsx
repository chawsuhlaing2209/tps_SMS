"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "../../../components/shared/confirm-dialog";
import { EmptyState } from "../../../components/shared/empty-state";
import { useApiMutation } from "../../lib/api";
import { Icon } from "../../lib/material-icon";
import { toastSuccess } from "../../lib/toast";
import { StudentAddServiceSheet } from "./student-add-service-sheet";

export type StudentActiveService = {
  id: string;
  feeItemId?: string;
  feeItemName: string;
  billingType?: string;
  effectiveFrom: string;
};

type Props = {
  studentId: string;
  services: StudentActiveService[];
  canManage: boolean;
  onChanged: () => void;
};

export function StudentServicesPanel({ studentId, services, canManage, onChanged }: Props) {
  const t = useTranslations("finance.studentServices");
  const tFinance = useTranslations("finance");
  const c = useTranslations("common");

  const [addOpen, setAddOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const removeService = useApiMutation<string, { removed: boolean }>(
    (serviceId, tenant) => ({
      path: `/tenants/${tenant}/student-services/${serviceId}`,
      init: { method: "DELETE" }
    }),
    {
      invalidatePaths: (_, tenant) => [
        `/tenants/${tenant}/finance/students/${studentId}/summary`,
        `/tenants/${tenant}/student-services`
      ]
    }
  );

  async function confirmRemove() {
    if (!removeId) return;
    await removeService.mutateAsync(removeId);
    toastSuccess(t("removed"));
    setRemoveId(null);
    onChanged();
  }

  return (
    <>
      <div className="student-services-panel">
        <div className="student-services-panel__head">
          <h4 className="pds-type-title-xxs-extrabold student-profile-subheading">{tFinance("activeServices")}</h4>
          {canManage ? (
            <button
              type="button"
              className="pds-type-body-s-semibold table-row-action"
              onClick={() => setAddOpen(true)}
            >
              <Icon name="add" size={16} />
              {t("addService")}
            </button>
          ) : null}
        </div>

        {!services.length ? (
          <EmptyState compact embedded icon="handshake" title={tFinance("noActiveServices")} />
        ) : (
          <ul className="student-profile-billing-list student-services-panel__list">
            {services.map((service) => (
              <li key={service.id} className="student-services-panel__item">
                <div className="student-services-panel__meta">
                  <strong>{service.feeItemName}</strong>
                  <span className="pds-type-body-s-regular muted">
                    {service.billingType
                      ? tFinance(`billingTypes.${service.billingType}`)
                      : null}
                    {service.billingType ? " · " : ""}
                    {t("since", { date: service.effectiveFrom })}
                  </span>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    className="pds-type-body-s-semibold table-row-action"
                    onClick={() => setRemoveId(service.id)}
                  >
                    <Icon name="close" size={16} />
                    {t("remove")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canManage ? (
          <p className="pds-type-body-s-regular muted student-services-panel__hint">
            {t("manageHint")}{" "}
            <Link href="/dashboard/finance/fee-structures" className="padauk-table__link">
              {t("feeStructuresLink")}
            </Link>
          </p>
        ) : null}
      </div>

      <StudentAddServiceSheet
        studentId={studentId}
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={onChanged}
      />

      <ConfirmDialog
        open={Boolean(removeId)}
        onOpenChange={(open) => {
          if (!open) setRemoveId(null);
        }}
        title={t("removeTitle")}
        description={t("removeHelp")}
        confirmLabel={t("remove")}
        cancelLabel={c("cancel")}
        onConfirm={() => void confirmRemove()}
        loading={removeService.isPending}
      />
    </>
  );
}
