"use client";

import { useTranslations } from "next-intl";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDashPageTitleActionsTarget } from "../dashboard-page-title";
import { Icon } from "../../lib/material-icon";
import { hasAnyPermission } from "../../lib/permissions";
import { getSession } from "../../lib/session";

type TeachersActionsContextValue = {
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
};

const TeachersActionsContext = createContext<TeachersActionsContextValue | null>(null);

export function useTeachersActions() {
  const ctx = useContext(TeachersActionsContext);
  if (!ctx) {
    throw new Error("useTeachersActions must be used within TeachersActionsProvider");
  }
  return ctx;
}

export function TeachersActionsProvider({ children }: { children: ReactNode }) {
  const [createOpen, setCreateOpen] = useState(false);

  const value = useMemo(() => ({ createOpen, setCreateOpen }), [createOpen]);

  return (
    <TeachersActionsContext.Provider value={value}>{children}</TeachersActionsContext.Provider>
  );
}

function TeachersHeaderActions() {
  const t = useTranslations("teachers");
  const permissions = getSession()?.permissions;
  const canManageHr = hasAnyPermission(permissions, ["hr.manage"]);
  const { setCreateOpen } = useTeachersActions();

  if (!canManageHr) {
    return null;
  }

  return (
    <button
      type="button"
      className="pds-type-body-m-bold btn-primary"
      onClick={() => setCreateOpen(true)}
    >
      <Icon name="add" />
      {t("addTeacher")}
    </button>
  );
}

export function TeachersHeaderActionsPortal() {
  const target = useDashPageTitleActionsTarget();

  if (!target) {
    return null;
  }

  return createPortal(<TeachersHeaderActions />, target);
}
