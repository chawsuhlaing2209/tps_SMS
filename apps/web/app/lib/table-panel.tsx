"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "./icon";

export function TablePanelHead({
  title,
  help,
  onRefresh,
  onAdd,
  addLabel,
  extra
}: {
  title: string;
  help?: ReactNode;
  onRefresh?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  extra?: ReactNode;
}) {
  const c = useTranslations("common");

  return (
    <div className="panel-head">
      <div className="panel-head__titles">
        <h2>{title}</h2>
        {help ? <p className="panel-head__help">{help}</p> : null}
      </div>
      <div className="panel-actions">
        {extra}
        {onAdd ? (
          <button type="button" className="btn-primary" onClick={onAdd}>
            <Icon name="add" />
            {addLabel ?? c("add")}
          </button>
        ) : null}
        {onRefresh ? (
          <button type="button" className="btn-ghost" onClick={onRefresh}>
            <Icon name="refresh" />
            {c("refresh")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function TablePanelBody({
  loading,
  error,
  empty,
  children
}: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  children: ReactNode;
}) {
  const c = useTranslations("common");

  if (loading) {
    return (
      <div className="panel-body">
        <p className="muted">{c("loading")}</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="panel-body">
        <p className="error-text">{error}</p>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="panel-body">
        <p className="muted">{c("empty")}</p>
      </div>
    );
  }

  return <div className="panel-body">{children}</div>;
}
