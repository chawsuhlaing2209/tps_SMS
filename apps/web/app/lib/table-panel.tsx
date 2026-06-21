"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { EmptyState } from "../../components/shared/empty-state";

/**
 * Vertical stack for a list page: optional context banner, then table card.
 * Primary actions belong in {@link PageHeader} / dash-page-title; filters use
 * {@link PdsSearchFiltersRow}.
 */
export function DataTableSection({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["table-page-section", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

/**
 * Optional context banner above a table (e.g. working year). No row actions here.
 */
export function TablePanelHead({
  title: _title,
  banner,
  bannerVariant = "default",
  help
}: {
  /** @deprecated Section titles are not rendered; page context lives in the top bar. */
  title?: string;
  /** Left-side context copy (e.g. working year). Rendered with banner styling. */
  banner?: ReactNode;
  bannerVariant?: "default" | "warning";
  /** @deprecated Prefer {@link PageHeader} `description` for page-level intro copy. */
  help?: ReactNode;
}) {
  if (banner) {
    return (
      <div
        className={[
          "module-strip module-strip--row table-toolbar-card",
          bannerVariant === "warning" ? "table-toolbar-card--warning" : null
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <p className="pds-type-body-m-medium table-toolbar-card__banner">{banner}</p>
      </div>
    );
  }

  if (help) {
    return <p className="pds-type-body-s-regular muted">{help}</p>;
  }

  return null;
}

/**
 * Floating table card — table only, no toolbar. Handles loading / empty / error inside the card.
 */
export function TablePanelBody({
  loading,
  error,
  empty,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  variant = "card",
  unwrapEmpty,
  children
}: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  /** When set, the empty case renders a rich EmptyState instead of muted text. */
  emptyIcon?: string;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  /** `plain` skips wrappers entirely. `card-plain` keeps table-card but omits table-card__body. */
  variant?: "card" | "card-plain" | "plain";
  /** Render empty state directly in the parent panel (no table-card wrapper). */
  unwrapEmpty?: boolean;
  children: ReactNode;
}) {
  const c = useTranslations("common");
  const plain = variant === "plain";
  const cardPlain = variant === "card-plain";

  const wrapCard = (content: ReactNode) =>
    plain ? (
      content
    ) : cardPlain ? (
      <section className="table-card">{content}</section>
    ) : (
      <section className="table-card">
        <div className="table-card__body">{content}</div>
      </section>
    );

  if (loading) {
    return wrapCard(<p className="pds-type-body-s-regular muted">{c("loading")}</p>);
  }
  if (error) {
    return wrapCard(
      <EmptyState compact embedded icon="error" title={c("somethingWrong")} description={error} />
    );
  }
  if (empty) {
    const emptyState = (
      <EmptyState
        compact
        embedded
        icon={emptyIcon ?? "inbox"}
        title={emptyTitle ?? c("empty")}
        description={emptyDescription}
        action={emptyAction}
      />
    );
    return unwrapEmpty ? emptyState : wrapCard(emptyState);
  }

  return wrapCard(children);
}
