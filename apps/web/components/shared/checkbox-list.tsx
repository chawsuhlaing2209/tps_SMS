"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export type CheckboxListOption = {
  id: string;
  label: ReactNode;
};

type CheckboxListProps = {
  options: CheckboxListOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  emptyMessage?: ReactNode;
  disabled?: boolean;
};

export function CheckboxList({
  options,
  selectedIds,
  onChange,
  emptyMessage,
  disabled = false
}: CheckboxListProps) {
  const c = useTranslations("common");

  if (!options.length) {
    return emptyMessage ? <>{emptyMessage}</> : null;
  }

  const allSelected = options.every((option) => selectedIds.includes(option.id));
  const someSelected = selectedIds.length > 0;

  const toggleOption = (optionId: string) => {
    onChange(
      selectedIds.includes(optionId)
        ? selectedIds.filter((id) => id !== optionId)
        : [...selectedIds, optionId]
    );
  };

  return (
    <div className="checkbox-list-group">
      <div className="checkbox-list-toolbar">
        <button
          type="button"
          className="btn-ghost checkbox-list-action"
          disabled={disabled || allSelected}
          onClick={() => onChange(options.map((option) => option.id))}
        >
          {c("selectAll")}
        </button>
        <button
          type="button"
          className="btn-ghost checkbox-list-action"
          disabled={disabled || !someSelected}
          onClick={() => onChange([])}
        >
          {c("deselectAll")}
        </button>
      </div>
      <div className="checkbox-list">
        {options.map((option) => (
          <label key={option.id} className="form-check">
            <input
              type="checkbox"
              disabled={disabled}
              checked={selectedIds.includes(option.id)}
              onChange={() => toggleOption(option.id)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}
