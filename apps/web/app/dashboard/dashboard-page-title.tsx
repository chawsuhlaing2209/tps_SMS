"use client";

import { useResolvedPageHeader } from "./page-header-context";

export const DASH_PAGE_TITLE_ACTIONS_ID = "dash-page-title-actions";

/** Page title row — heading + optional trailing actions (Figma ContentTitle row). */
export function DashboardPageTitle() {
  const { title, actions, actionsPortal } = useResolvedPageHeader();

  if (!title) return null;

  return (
    <div className="dash-page-title">
      <h1 className="pds-type-title-m-extrabold dash-page-title__heading">{title}</h1>
      {actions || actionsPortal ? (
        <div id={DASH_PAGE_TITLE_ACTIONS_ID} className="dash-page-title__actions">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
