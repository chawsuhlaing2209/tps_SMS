"use client";

import { useTranslations } from "next-intl";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function PaginationControls({ page, pageSize, total, onPageChange }: Props) {
  const t = useTranslations("common");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;

  return (
    <div className="pagination">
      <span className="muted">
        {t("paginationSummary", {
          from: total === 0 ? 0 : page * pageSize + 1,
          to: Math.min((page + 1) * pageSize, total),
          total
        })}
      </span>
      <div className="pagination-actions">
        <button
          type="button"
          className="btn-ghost"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
        >
          {t("previous")}
        </button>
        <span className="muted">
          {t("pageOf", { page: page + 1, total: totalPages })}
        </span>
        <button
          type="button"
          className="btn-ghost"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
        >
          {t("next")}
        </button>
      </div>
    </div>
  );
}
