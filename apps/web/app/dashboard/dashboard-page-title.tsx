"use client";

import { useLayoutEffect, useState } from "react";
import { useResolvedPageHeader } from "./page-header-context";

export const DASH_PAGE_TITLE_ACTIONS_ID = "dash-page-title-actions";

/** Resolves the title-row actions DOM target once {@link PageHeader} publishes `actionsPortal`. */
export function useDashPageTitleActionsTarget(): HTMLElement | null {
  const { actionsPortal } = useResolvedPageHeader();
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!actionsPortal) {
      setTarget(null);
      return;
    }
    setTarget(document.getElementById(DASH_PAGE_TITLE_ACTIONS_ID));
  }, [actionsPortal]);

  return actionsPortal ? target : null;
}

/** Page title row — heading, optional description under the title, trailing actions. */
export function DashboardPageTitle() {
  const { title, description, actions, actionsPortal, showTitle } = useResolvedPageHeader();

  if (!title || showTitle === false) return null;

  return (
    <div className="dash-page-title">
      <div className="dash-page-title__main">
        <h1 className="pds-type-title-m-extrabold dash-page-title__heading">{title}</h1>
        {description ? (
          <p className="pds-type-body-s-regular muted dash-page-title__description">{description}</p>
        ) : null}
      </div>
      {actions || actionsPortal ? (
        <div id={DASH_PAGE_TITLE_ACTIONS_ID} className="dash-page-title__actions">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
