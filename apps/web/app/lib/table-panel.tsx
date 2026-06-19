"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { EmptyState } from "../../components/shared/empty-state";
import { Icon } from "./material-icon";

/**
 * Vertical stack for a list page: toolbar card (banner + actions), then table card.
 * Do not wrap {@link TablePanelHead} and {@link TablePanelBody} in `.panel`.
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
 * Toolbar card — context banner or help on the left, actions on the right (one card).
 */
export function TablePanelHead({
  title: _title,
  banner,
  bannerVariant = "default",
  help,
  onRefresh,
  onAdd,
  addLabel,
  extra
}: {
  /** @deprecated Section titles are not rendered; page context lives in the top bar. */
  title?: string;
  /** Left-side context copy (e.g. working year). Rendered with banner styling. */
  banner?: ReactNode;
  bannerVariant?: "default" | "warning";
  help?: ReactNode;
  onRefresh?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  extra?: ReactNode;
}) {
  const c = useTranslations("common");
  const hasLeft = Boolean(banner || help);
  const hasActions = Boolean(extra || onAdd || onRefresh);
  const hasToolbar = hasLeft || hasActions;

  if (!hasToolbar) {
    return null;
  }

  return (
    <div
      className={[
        "module-strip module-strip--row table-toolbar-card",
        !hasLeft ? "table-toolbar-card--actions-only" : null,
        bannerVariant === "warning" ? "table-toolbar-card--warning" : null
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {banner ? (
        <p className="pds-type-body-m-medium table-toolbar-card__banner">{banner}</p>
      ) : help ? (
        <p className="pds-type-body-m-medium module-strip__help">{help}</p>
      ) : null}
      {hasActions ? (
        <div className="table-section__actions">
          {extra}
          {onAdd ? (
            <button type="button" className="pds-type-body-m-bold btn-primary" onClick={onAdd}>
              <Icon name="add" />
              {addLabel ?? c("add")}
            </button>
          ) : null}
          {onRefresh ? (
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={onRefresh}>
              <Icon name="refresh" />
              {c("refresh")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
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
  children: ReactNode;
}) {
  const c = useTranslations("common");

  if (loading) {
    return (
      <section className="table-card">
        <div className="table-card__body">
          <p className="pds-type-body-s-regular muted">{c("loading")}</p>
        </div>
      </section>
    );
  }
  if (error) {
    return (
      <section className="table-card">
        <div className="table-card__body">
          <EmptyState compact embedded icon="error" title={c("somethingWrong")} description={error} />
        </div>
      </section>
    );
  }
  if (empty) {
    return (
      <section className="table-card">
        <div className="table-card__body">
          <EmptyState
            compact
            embedded
            icon={emptyIcon ?? "inbox"}
            title={emptyTitle ?? c("empty")}
            description={emptyDescription}
            action={emptyAction}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="table-card">
      <div className="table-card__body">{children}</div>
    </section>
  );
}
