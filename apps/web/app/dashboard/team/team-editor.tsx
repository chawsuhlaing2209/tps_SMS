"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { roleDisplayFor } from "@sms/shared";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { PdsSearchBar, PdsSearchFiltersRow } from "../../../components/pds";
import { StatusBadge, Badge } from "../../../components/shared/badge";
import { useApiQuery } from "../../lib/api";
import { DataTable, DirectoryMemberCell } from "../../lib/data-table";
import { Icon } from "../../lib/material-icon";
import { resetNavigationTrail } from "../../lib/navigation-trail";
import { PaginationControls } from "../../lib/pagination-controls";
import { hasAnyPermission } from "../../lib/permissions";
import { localizedRoleLabel } from "../../lib/role-label";
import { getSession } from "../../lib/session";
import { TablePanelBody, DataTableSection } from "../../lib/table-panel";
import { useDashPageTitleActionsTarget } from "../dashboard-page-title";
import { TeamMemberFormSheet } from "./team-member-form-sheet";

type StaffOverview = {
  id: string;
  fullName: string;
  employmentRole: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  departmentId: string | null;
  joinDate: string | null;
  userId: string | null;
  status: string;
  loginEmail: string | null;
  loginStatus: string | null;
  rbacRoleKey: string | null;
};

type Role = { id: string; key: string; name: string };

type StaffOverviewPage = {
  data: StaffOverview[];
  total: number;
  limit: number;
  offset: number;
};

const PAGE_SIZE = 50;

const staffOverviewPath = (tenant: string, page: number, search: string) => {
  const params = new URLSearchParams({
    excludeEmploymentRole: "teacher",
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE)
  });
  if (search.trim()) params.set("search", search.trim());
  return `/tenants/${tenant}/hr/staff/overview?${params.toString()}`;
};

const ASSIGNABLE_ROLES_PATH = (tenant: string) =>
  `/tenants/${tenant}/hr/assignable-roles?scope=team`;

export function TeamEditor() {
  const t = useTranslations("team");
  const tNames = useTranslations("settings.roles.names");
  const c = useTranslations("common");
  const router = useRouter();
  const permissions = getSession()?.permissions;
  const canManageHr = hasAnyPermission(permissions, ["hr.manage"]);
  const canView = canManageHr || hasAnyPermission(permissions, ["identity.manage"]);

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [search]);

  const queryPath = useMemo(
    () => (tenant: string) => staffOverviewPath(tenant, page, search),
    [page, search]
  );

  const staff = useApiQuery<StaffOverviewPage>(canView ? queryPath : () => null);
  const roles = useApiQuery<Role[]>((tenant) =>
    canView ? ASSIGNABLE_ROLES_PATH(tenant) : null
  );

  const roleLabel = (key: string, name?: string) =>
    localizedRoleLabel(roleDisplayFor(key, name), tNames, name);

  const columns: ColumnDef<StaffOverview, unknown>[] = [
    {
      id: "name",
      header: c("staffMember"),
      cell: ({ row }) => (
        <DirectoryMemberCell name={row.original.fullName} email={row.original.email ?? row.original.loginEmail} />
      )
    },
    {
      id: "role",
      header: t("role"),
      cell: ({ row }) => {
        const roleKey = row.original.rbacRoleKey ?? "";
        const roleName = roles.data?.find((r) => r.key === roleKey)?.name;
        const label = roleLabel(roleKey, roleName);
        return <Badge tone="neutral">{label}</Badge>;
      }
    },
    {
      id: "department",
      header: c("subjectGrade"),
      accessorFn: (row) => row.department ?? "—"
    },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />
    }
  ];

  if (!canView) {
    return null;
  }

  return (
    <>
      <DataTableSection>
        <TeamHeaderActionsPortal onAdd={canManageHr ? () => setCreateOpen(true) : undefined} />
        <PdsSearchFiltersRow
          filters={
            <PdsSearchBar
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("search")}
              aria-label={t("search")}
            />
          }
        />
        <TablePanelBody
          variant="card-plain"
          loading={staff.isLoading}
          error={staff.isError ? c("somethingWrong") : null}
          empty={!staff.data?.data.length}
        >
          <DataTable
            columns={columns}
            data={staff.data?.data ?? []}
            onRowClick={(member) => {
              resetNavigationTrail([
                { label: t("title"), href: "/dashboard/team" },
                { label: member.fullName, href: `/dashboard/team/${member.id}` }
              ]);
              router.push(`/dashboard/team/${member.id}`);
            }}
          />
        </TablePanelBody>
      </DataTableSection>

      <PaginationControls
        page={page}
        pageSize={PAGE_SIZE}
        total={staff.data?.total ?? 0}
        onPageChange={setPage}
      />

      {canManageHr ? (
        <TeamMemberFormSheet
          open={createOpen}
          onOpenChange={setCreateOpen}
          member={null}
          onSaved={() => void staff.refetch()}
        />
      ) : null}
    </>
  );
}

function TeamHeaderActionsPortal({ onAdd }: { onAdd?: () => void }) {
  const t = useTranslations("team");
  const target = useDashPageTitleActionsTarget();

  if (!target) {
    return null;
  }

  return createPortal(
    <>
      {onAdd ? (
        <button type="button" className="pds-type-body-m-bold btn-primary" onClick={onAdd}>
          <Icon name="add" />
          {t("addMember")}
        </button>
      ) : null}
    </>,
    target
  );
}
