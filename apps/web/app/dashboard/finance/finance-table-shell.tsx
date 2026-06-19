"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { EmptyState } from "../../../components/shared/empty-state";

export function FinanceTableShell({
  loading,
  error,
  empty,
  emptyMessage,
  children
}: {
  loading?: boolean;
  error?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
}) {
  const c = useTranslations("common");

  if (loading) {
    return (
      <section className="table-section">
        <p className="pds-type-body-s-regular muted">{c("loading")}</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="table-section">
        <EmptyState compact embedded icon="error" title={c("somethingWrong")} />
      </section>
    );
  }

  if (empty) {
    return (
      <section className="table-section">
        <EmptyState compact embedded icon="inbox" title={emptyMessage ?? c("empty")} />
      </section>
    );
  }

  return <section className="table-section">{children}</section>;
}
