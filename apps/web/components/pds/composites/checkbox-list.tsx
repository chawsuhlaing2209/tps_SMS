"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import { EmptyState } from "../../shared/empty-state";
import { CheckListItem } from "../subcomponents/check-list-item";
import { CheckBox } from "../subcomponents/check-box";

export type CheckboxListOption = {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  /** Numeric amount summed in the footer when `showTotal` is enabled. */
  amount?: number;
  /** Pre-formatted trailing value (overrides `amount` display). */
  trailing?: ReactNode;
};

export type CheckboxListProps = {
  options: CheckboxListOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Card header title (e.g. "Fee components"). */
  title?: ReactNode;
  /** Muted helper shown above the card (section intro). */
  description?: ReactNode;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  emptyIcon?: string;
  disabled?: boolean;
  /** Show selected-amount footer. Defaults to true when any option has `amount`. */
  showTotal?: boolean;
  totalLabel?: ReactNode;
  currencyLabel?: string;
  className?: string;
};

function formatAmount(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

export function CheckboxList({
  options,
  selectedIds,
  onChange,
  title,
  description,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  disabled = false,
  showTotal,
  totalLabel,
  currencyLabel = "MMK",
  className,
}: CheckboxListProps) {
  const c = useTranslations("common");

  if (!options.length) {
    return (
      <EmptyState
        compact
        embedded
        icon={emptyIcon ?? "inbox"}
        title={emptyTitle ?? c("empty")}
        description={emptyDescription}
      />
    );
  }

  const selectedCount = options.filter((option) => selectedIds.includes(option.id)).length;
  const allSelected = selectedCount === options.length;
  const someSelected = selectedCount > 0;
  const indeterminate = someSelected && !allSelected;
  const hasAmounts = options.some((option) => option.amount != null);
  const showFooter = showTotal ?? hasAmounts;

  const selectedTotal = options.reduce((sum, option) => {
    if (!selectedIds.includes(option.id) || option.amount == null) {
      return sum;
    }
    return sum + option.amount;
  }, 0);

  const toggleAll = () => {
    onChange(allSelected ? [] : options.map((option) => option.id));
  };

  const toggleOption = (optionId: string) => {
    onChange(
      selectedIds.includes(optionId)
        ? selectedIds.filter((id) => id !== optionId)
        : [...selectedIds, optionId],
    );
  };

  return (
    <div className={cn("checkbox-list-card", className)}>
      <div className="checkbox-list-card__header">
        <div className="checkbox-list-card__header-main">
          <CheckBox
            size="sm"
            showLabel={false}
            disabled={disabled}
            checked={allSelected}
            indeterminate={indeterminate}
            onCheckedChange={toggleAll}
            aria-label={allSelected ? c("deselectAll") : c("selectAll")}
          />
          <div className="checkbox-list-card__header-text">
            {title ? (
              <p className="pds-type-body-m-bold checkbox-list-card__title">{title}</p>
            ) : null}
            {description ? (
              <p className="pds-type-body-s-regular muted checkbox-list-card__desc">{description}</p>
            ) : null}
            <p className="pds-type-body-s-regular checkbox-list-card__count">
              {c("checkboxListSelectedCount", { selected: selectedCount, total: options.length })}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="pds-type-body-m-bold checkbox-list-card__select-all"
          disabled={disabled}
          onClick={toggleAll}
        >
          {allSelected ? c("deselectAll") : c("selectAll")}
        </button>
      </div>

      <ul className="checkbox-list-card__rows">
        {options.map((option) => {
          const rowId = `checkbox-list-${option.id}`;
          const checked = selectedIds.includes(option.id);
          const trailing =
            option.trailing ??
            (option.amount != null ? formatAmount(option.amount) : null);

          return (
            <li key={option.id}>
              <CheckListItem
                id={rowId}
                checked={checked}
                disabled={disabled}
                label={option.label}
                description={option.description}
                trailing={trailing}
                onCheckedChange={() => toggleOption(option.id)}
              />
            </li>
          );
        })}
      </ul>

      {showFooter ? (
        <div className="checkbox-list-card__footer">
          <span className="pds-type-caption-m checkbox-list-card__footer-label">
            {totalLabel ?? c("checkboxListSelectedTotal")}
          </span>
          <span className="checkbox-list-card__footer-value">
            <strong className="pds-type-title-s-extrabold">{formatAmount(selectedTotal)}</strong>
            <span className="pds-type-body-s-regular checkbox-list-card__footer-currency">{currencyLabel}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
