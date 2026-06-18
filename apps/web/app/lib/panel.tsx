"use client";

import type { ReactNode } from "react";

/**
 * Header row for a {@link Panel}: a title (with optional muted help line stacked
 * under it) on the left and an actions slot on the right.
 */
export function PanelHead({
  title,
  help,
  actions
}: {
  title: ReactNode;
  help?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="panel-head">
      <div className="panel-head__titles">
        <h2>{title}</h2>
        {help ? <p className="panel-head__help">{help}</p> : null}
      </div>
      {actions ? <div className="panel-actions">{actions}</div> : null}
    </div>
  );
}

/**
 * Standard white rounded card (the Padauk `.panel`). Wraps the existing `.panel`
 * CSS so pages stop hand-rolling the markup; pass extra classes via `className`.
 */
export function Panel({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={["panel", className].filter(Boolean).join(" ")}>{children}</section>;
}
