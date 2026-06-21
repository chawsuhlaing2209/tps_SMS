"use client";

import { useTranslations } from "next-intl";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDashPageTitleActionsTarget } from "../dashboard-page-title";
import { Icon } from "../../lib/material-icon";
import { hasAnyPermission } from "../../lib/permissions";
import { getSession } from "../../lib/session";

export type PeopleDirectoryTab = "students" | "guardians" | "households";

type PeopleDirectoryActionsContextValue = {
  activeTab: PeopleDirectoryTab;
  studentsRegisterOpen: boolean;
  setStudentsRegisterOpen: (open: boolean) => void;
  guardianCreateOpen: boolean;
  setGuardianCreateOpen: (open: boolean) => void;
  householdCreateOpen: boolean;
  setHouseholdCreateOpen: (open: boolean) => void;
};

const PeopleDirectoryActionsContext = createContext<PeopleDirectoryActionsContextValue | null>(
  null
);

export function usePeopleDirectoryActions() {
  const ctx = useContext(PeopleDirectoryActionsContext);
  if (!ctx) {
    throw new Error("usePeopleDirectoryActions must be used within PeopleDirectoryActionsProvider");
  }
  return ctx;
}

export function PeopleDirectoryActionsProvider({
  activeTab,
  children
}: {
  activeTab: PeopleDirectoryTab;
  children: ReactNode;
}) {
  const [studentsRegisterOpen, setStudentsRegisterOpen] = useState(false);
  const [guardianCreateOpen, setGuardianCreateOpen] = useState(false);
  const [householdCreateOpen, setHouseholdCreateOpen] = useState(false);

  const value = useMemo(
    () => ({
      activeTab,
      studentsRegisterOpen,
      setStudentsRegisterOpen,
      guardianCreateOpen,
      setGuardianCreateOpen,
      householdCreateOpen,
      setHouseholdCreateOpen
    }),
    [
      activeTab,
      studentsRegisterOpen,
      guardianCreateOpen,
      householdCreateOpen
    ]
  );

  return (
    <PeopleDirectoryActionsContext.Provider value={value}>
      {children}
    </PeopleDirectoryActionsContext.Provider>
  );
}

function PeopleDirectoryHeaderActions() {
  const tStudents = useTranslations("students");
  const tGuardians = useTranslations("guardians");
  const tHouseholds = useTranslations("households");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["student.manage"]);
  const {
    activeTab,
    setStudentsRegisterOpen,
    setGuardianCreateOpen,
    setHouseholdCreateOpen
  } = usePeopleDirectoryActions();

  if (!canManage) {
    return null;
  }

  if (activeTab === "students") {
    return (
      <button
        type="button"
        className="pds-type-body-m-bold btn-primary"
        onClick={() => setStudentsRegisterOpen(true)}
      >
        <Icon name="add" />
        {tStudents("registerTitle")}
      </button>
    );
  }

  if (activeTab === "guardians") {
    return (
      <button
        type="button"
        className="pds-type-body-m-bold btn-primary"
        onClick={() => setGuardianCreateOpen(true)}
      >
        <Icon name="add" />
        {tGuardians("addGuardian")}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="pds-type-body-m-bold btn-primary"
      onClick={() => setHouseholdCreateOpen(true)}
    >
      <Icon name="add" />
      {tHouseholds("addHousehold")}
    </button>
  );
}

export function PeopleDirectoryHeaderActionsPortal() {
  const target = useDashPageTitleActionsTarget();

  if (!target) {
    return null;
  }

  return createPortal(<PeopleDirectoryHeaderActions />, target);
}
