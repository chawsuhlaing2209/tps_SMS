"use client";

import { useTranslations } from "next-intl";
import { formatMMK } from "../../../lib/money";
import { RowMoreActionsMenu } from "../../../../components/shared/row-more-actions";
import { Icon } from "../../../lib/material-icon";
import { isPadaukRowInteractiveTarget } from "../../../lib/table-row-interaction";
import { cn } from "../../../../lib/utils";
import { benefitIconTone } from "./benefit-icon-themes";
import type { BenefitPackageRecord } from "./benefit-package-form-sheet";

function formatMoney(value: number): string {
  return formatMMK(value);
}

type Props = {
  pkg: BenefitPackageRecord;
  onEdit: (pkg: BenefitPackageRecord) => void;
  onArchive?: (pkg: BenefitPackageRecord) => void;
  onRestore?: (pkg: BenefitPackageRecord) => void;
  onDelete?: (pkg: BenefitPackageRecord) => void;
};

export function BenefitPackageCard({ pkg, onEdit, onArchive, onRestore, onDelete }: Props) {
  const t = useTranslations("salary");
  const c = useTranslations("common");
  const tone = benefitIconTone(pkg.icon);
  const isActive = pkg.status === "active";

  return (
    <article
      className="benefit-package-card"
      tabIndex={0}
      onClick={(event) => {
        if (isPadaukRowInteractiveTarget(event.target)) return;
        onEdit(pkg);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onEdit(pkg);
      }}
    >
      <div className="benefit-package-card__header">
        <span
          className={cn("benefit-package-card__icon", `benefit-package-card__icon--${tone}`)}
          aria-hidden
        >
          <Icon name={pkg.icon ?? "redeem"} size={22} />
        </span>
        <div className="benefit-package-card__header-actions">
          {isActive ? (
            <span className="pds-type-body-s-bold benefit-package-card__status">{t("status.active")}</span>
          ) : (
            <span className="pds-type-body-s-bold benefit-package-card__status benefit-package-card__status--muted">
              {t(`status.${pkg.status}` as "status.archived")}
            </span>
          )}
          <RowMoreActionsMenu
            ariaLabel={c("moreActions")}
            items={[
              {
                id: "edit",
                label: c("edit"),
                icon: "edit",
                onSelect: () => onEdit(pkg)
              },
              ...(onArchive && isActive
                ? [
                    {
                      id: "archive",
                      label: c("archive"),
                      icon: "archive",
                      destructive: true,
                      onSelect: () => onArchive(pkg)
                    }
                  ]
                : []),
              ...(!isActive && onRestore
                ? [
                    {
                      id: "restore",
                      label: c("restore"),
                      icon: "restore",
                      onSelect: () => onRestore(pkg)
                    }
                  ]
                : []),
              ...(!isActive && onDelete
                ? [
                    {
                      id: "delete",
                      label: c("deletePermanently"),
                      icon: "delete_forever",
                      destructive: true,
                      onSelect: () => onDelete(pkg)
                    }
                  ]
                : [])
            ]}
          />
        </div>
      </div>

      <h2 className="pds-type-title-xs-bold benefit-package-card__title">{pkg.name}</h2>
      {pkg.description ? (
        <p className="pds-type-body-s-regular benefit-package-card__description">{pkg.description}</p>
      ) : null}

      <div className="benefit-package-card__stats">
        <div className="benefit-package-card__stat">
          <span className="pds-type-caption-s benefit-package-card__stat-label">{t("monthlyValue")}</span>
          <strong className="pds-type-title-xxs-extrabold benefit-package-card__stat-value">
            {formatMoney(pkg.monthlyValue)}
          </strong>
        </div>
        <div className="benefit-package-card__stat">
          <span className="pds-type-caption-s benefit-package-card__stat-label">{t("enrolledCount")}</span>
          <strong className="pds-type-title-xxs-extrabold benefit-package-card__stat-value">
            {pkg.enrolledCount}
          </strong>
        </div>
      </div>

      <div className="benefit-package-card__eligibility">
        <Icon name="groups" size={15} />
        <span className="pds-type-label-s-bold">{t(`eligibility.${pkg.eligibility}` as "eligibility.all_staff")}</span>
      </div>
    </article>
  );
}
