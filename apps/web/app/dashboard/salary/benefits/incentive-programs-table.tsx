"use client";

import { useTranslations } from "next-intl";
import { Icon } from "../../../lib/material-icon";
import { cn } from "../../../../lib/utils";
import { benefitIconTone } from "./benefit-icon-themes";
import type { IncentiveProgramRecord } from "./incentive-program-form-sheet";

const FALLBACK_ICONS = [
  "trending_up",
  "event_available",
  "workspace_premium",
  "military_tech",
  "celebration"
] as const;

function formatMoney(value: number) {
  return Math.round(value).toLocaleString();
}

function iconForProgram(program: IncentiveProgramRecord) {
  if (program.icon) return program.icon;
  let hash = 0;
  for (const char of program.id) hash = (hash + char.charCodeAt(0)) % FALLBACK_ICONS.length;
  return FALLBACK_ICONS[hash] ?? FALLBACK_ICONS[0];
}

function paidDisplay(program: IncentiveProgramRecord) {
  if (program.awardType === "percent") {
    return null;
  }
  const recipients = program.recipients ?? program.eligibleCount ?? 0;
  const total = program.amount * recipients;
  return total > 0 ? `${formatMoney(total)} MMK` : null;
}

type Props = {
  programs: IncentiveProgramRecord[];
  onEdit: (program: IncentiveProgramRecord) => void;
};

export function IncentiveProgramsTable({ programs, onEdit }: Props) {
  const t = useTranslations("salary");
  const c = useTranslations("common");

  return (
    <div className="padauk-table-wrap incentive-programs-table-wrap">
      <table className="pds-type-body-m-medium padauk-table incentive-programs-table">
        <thead>
          <tr>
            <th className="pds-type-caption-s incentive-programs-table__col-program">
              {t("incentiveProgramColumn")}
            </th>
            <th className="pds-type-caption-s incentive-programs-table__col-cadence">
              {t("cadenceColumn")}
            </th>
            <th className="pds-type-caption-s padauk-table__num incentive-programs-table__col-award">
              {t("award")}
            </th>
            <th className="pds-type-caption-s incentive-programs-table__col-recipients">
              {t("recipientsColumn")}
            </th>
            <th className="pds-type-caption-s padauk-table__num incentive-programs-table__col-paid">
              {t("paidColumn")}
            </th>
            <th className="incentive-programs-table__col-action" aria-hidden />
          </tr>
        </thead>
        <tbody>
          {programs.map((program) => {
            const iconName = iconForProgram(program);
            const tone = benefitIconTone(iconName);
            const recipients = program.recipients ?? program.eligibleCount ?? 0;
            const paid = paidDisplay(program);

            return (
              <tr key={program.id}>
                <td>
                  <div className="incentive-programs-table__program">
                    <span
                      className={cn(
                        "incentive-programs-table__icon",
                        `benefit-package-card__icon--${tone}`
                      )}
                      aria-hidden
                    >
                      <Icon name={iconName} size={20} />
                    </span>
                    <span className="pds-type-body-m-bold incentive-programs-table__name">{program.name}</span>
                  </div>
                </td>
                <td>
                  <span className="pds-type-body-s-semibold incentive-programs-table__cadence">
                    {t(`cadence.${program.cadence}` as "cadence.monthly")}
                  </span>
                </td>
                <td className="padauk-table__num">
                  <span className="incentive-programs-table__award">
                    <strong className="pds-type-body-m-bold incentive-programs-table__award-value">
                      {program.awardType === "percent"
                        ? program.amount
                        : formatMoney(program.amount)}
                    </strong>
                    <span className="pds-type-body-s-semibold incentive-programs-table__award-unit">
                      {program.awardType === "percent" ? "%" : "MMK"}
                    </span>
                  </span>
                </td>
                <td className="incentive-programs-table__col-recipients">
                  <span className="pds-type-body-s-semibold incentive-programs-table__recipients">
                    {recipients}
                  </span>
                </td>
                <td className="padauk-table__num">
                  {paid ? (
                    <span className="pds-type-body-m-bold incentive-programs-table__paid">{paid}</span>
                  ) : (
                    <span className="pds-type-body-m-bold incentive-programs-table__paid incentive-programs-table__paid--empty">
                      —
                    </span>
                  )}
                </td>
                <td className="padauk-table__actions">
                  <button
                    type="button"
                    className="incentive-programs-table__edit"
                    aria-label={c("edit")}
                    onClick={() => onEdit(program)}
                  >
                    <Icon name="edit" size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
