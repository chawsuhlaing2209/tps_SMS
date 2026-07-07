"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useTranslations } from "next-intl";
import { Icon } from "../lib/material-icon";
import { roleDisplayFor } from "@sms/shared";
import { localizedRoleLabel } from "../lib/role-label";

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "—";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

export function SidebarUserCard({
  displayName,
  roles,
  collapsed = false,
  onSignOut
}: {
  displayName: string;
  roles?: string[];
  collapsed?: boolean;
  onSignOut: () => void;
}) {
  const t = useTranslations("nav");
  const tNames = useTranslations("settings.roles.names");
  const roleKey = roles?.[0];
  const roleLabel = roleKey
    ? localizedRoleLabel(roleDisplayFor(roleKey), tNames)
    : t("signedIn");

  const trigger = (
    <button
      type="button"
      className={collapsed ? "dash-user-card dash-user-card--collapsed" : "dash-user-card"}
      aria-label={t("accountMenu")}
    >
      <span className="pds-type-body-m-medium dash-user-card__avatar">{initialsFrom(displayName)}</span>
      {!collapsed ? (
        <>
          <span className="dash-user-card__meta">
            <span className="pds-type-body-m-medium dash-user-card__name">{displayName}</span>
            <span className="dash-user-card__role">{roleLabel}</span>
          </span>
          <Icon name="unfold_more" size={18} className="dash-user-card__chevron" />
        </>
      ) : null}
    </button>
  );

  return (
    <div className={collapsed ? "dash-user-card-wrap dash-user-card-wrap--collapsed" : "dash-user-card-wrap"}>
      <DropdownMenu.Root>
        {collapsed ? (
          <Tooltip.Root delayDuration={200}>
            <Tooltip.Trigger asChild>
              <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="dash-nav-tooltip"
                side="right"
                sideOffset={8}
                collisionPadding={12}
              >
                {displayName}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ) : (
          <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
        )}
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="dash-user-menu"
            side="top"
            align="start"
            sideOffset={8}
          >
            <DropdownMenu.Item
              className="pds-type-body-m-medium dash-user-menu__item"
              onSelect={(event) => {
                event.preventDefault();
                onSignOut();
              }}
            >
              <Icon name="logout" size={18} />
              {t("signOut")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
