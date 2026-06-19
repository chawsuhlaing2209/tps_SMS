"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useTranslations } from "next-intl";
import { Icon } from "../lib/material-icon";
import { LanguageSwitcher } from "../lib/language-switcher";

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

function humanizeRole(roles: string[] | undefined, fallback: string): string {
  const first = roles?.[0];
  if (!first) {
    return fallback;
  }
  return first
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function SidebarUserCard({
  displayName,
  roles,
  onSignOut
}: {
  displayName: string;
  roles?: string[];
  onSignOut: () => void;
}) {
  const t = useTranslations("nav");
  const roleLabel = humanizeRole(roles, t("signedIn"));

  return (
    <div className="dash-user-card-wrap">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" className="dash-user-card" aria-label={t("accountMenu")}>
            <span className="pds-type-body-m-medium dash-user-card__avatar">{initialsFrom(displayName)}</span>
            <span className="dash-user-card__meta">
              <span className="pds-type-body-m-medium dash-user-card__name">{displayName}</span>
              <span className="dash-user-card__role">{roleLabel}</span>
            </span>
            <Icon name="unfold_more" size={18} className="dash-user-card__chevron" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="dash-user-menu"
            side="top"
            align="start"
            sideOffset={8}
          >
            <div className="dash-user-menu__section">
              <span className="dash-user-menu__label">
                <Icon name="language" size={16} />
                {t("language")}
              </span>
              <LanguageSwitcher />
            </div>
            <DropdownMenu.Separator className="dash-user-menu__sep" />
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
