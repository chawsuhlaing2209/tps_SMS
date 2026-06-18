"use client";

import type { ReactNode } from "react";

/**
 * Header row for a {@link Panel}: a title (with optional muted help line stacked
 * under it) on the left and an actions slot on the right.
 */
export function PanelHead({
  title: _title,
  help: _help,
  actions
}: {
  /** @deprecated Section titles are not rendered; page context lives in the top bar. */
  title?: ReactNode;
  help?: ReactNode;
  actions?: ReactNode;
}) {
  if (!actions) {
    return null;
  }

  return (
    <div className="panel-head">
      <div className="panel-actions">{actions}</div>
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
