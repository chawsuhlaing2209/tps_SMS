"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode
} from "react";
import { NAV_ICONS } from "../lib/dashboard-nav-icons";
import {
  DASHBOARD_NAV_SUBMODULES,
  filterSubmoduleGroups,
  firstSubmoduleHref,
  isModuleWithSubmodulesActive,
  isSubmoduleActive,
  MODULE_PATH_PREFIX,
  type NavSubmoduleDef,
  type NavSubmoduleGroupDef
} from "../lib/dashboard-nav-submodules";
import { Icon } from "../lib/material-icon";
import { resetNavigationTrail } from "../lib/navigation-trail";
import {
  type DashboardNavItem,
  type DashboardNavKey,
  visibleDashboardNavGroups
} from "../lib/permissions";
import { SidebarUserCard } from "./sidebar-user-card";
import { useNavPrefetch } from "../lib/use-nav-prefetch";
import { useSchoolBrand } from "../lib/use-school-brand";

const SIDEBAR_COLLAPSED_KEY = "pds-sidebar-collapsed";

function withCollapsedTooltip(
  collapsed: boolean,
  label: string,
  node: ReactElement
): ReactElement {
  if (!collapsed) {
    return node;
  }

  return (
    <Tooltip.Root delayDuration={200}>
      <Tooltip.Trigger asChild>{node}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="dash-nav-tooltip"
          side="right"
          sideOffset={8}
          collisionPadding={12}
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

type SubmoduleTranslators = Record<
  "nav" | "finance" | "academicSetup" | "settings" | "exams" | "salary" | "leaves",
  ReturnType<typeof useTranslations>
>;

function submoduleLabel(
  translators: SubmoduleTranslators,
  item: NavSubmoduleDef
): string {
  const t = translators[item.labelNs as keyof SubmoduleTranslators];
  return t(item.labelKey);
}

function subgroupLabel(
  translators: SubmoduleTranslators,
  group: NavSubmoduleGroupDef
): string | undefined {
  if (!group.labelNs || !group.labelKey) {
    return undefined;
  }
  const t = translators[group.labelNs as keyof SubmoduleTranslators];
  return t(group.labelKey);
}

function moduleExpandedForPath(
  pathname: string,
  navGroups: ReturnType<typeof visibleDashboardNavGroups>,
  permissions: readonly string[] | undefined
): DashboardNavKey | null {
  let best: { key: DashboardNavKey; prefixLen: number } | null = null;

  for (const group of navGroups) {
    for (const item of group.items) {
      const rawGroups = DASHBOARD_NAV_SUBMODULES[item.key];
      if (!rawGroups?.length) {
        continue;
      }
      const filtered = filterSubmoduleGroups(rawGroups, permissions);
      if (!filtered.length || !isModuleWithSubmodulesActive(pathname, item.key, filtered)) {
        continue;
      }
      const modulePrefix = MODULE_PATH_PREFIX[item.key] ?? item.href;
      const prefixLen = modulePrefix.length;
      if (!best || prefixLen > best.prefixLen) {
        best = { key: item.key, prefixLen };
      }
    }
  }

  return best?.key ?? null;
}

type SidebarIdentityProps = {
  displayName: string;
  roles?: string[];
  tenantSlug: string;
  permissions: readonly string[];
  onSignOut: () => void;
};

/**
 * Brand block + nav groups + user card — shared by the desktop `<aside>` and
 * the mobile drawer. `collapsed` is always false in drawer mode.
 */
function SidebarContent({
  displayName,
  roles,
  tenantSlug,
  permissions,
  onSignOut,
  collapsed,
  onNavigate,
  headerAction
}: SidebarIdentityProps & {
  collapsed: boolean;
  onNavigate?: () => void;
  headerAction?: ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tFinance = useTranslations("finance");
  const tAcademicSetup = useTranslations("academicSetup");
  const tSettings = useTranslations("settings");
  const tExams = useTranslations("exams");
  const tSalary = useTranslations("salary");
  const tLeaves = useTranslations("leaves");

  const translators = useMemo<SubmoduleTranslators>(
    () => ({
      nav: t,
      finance: tFinance,
      academicSetup: tAcademicSetup,
      settings: tSettings,
      exams: tExams,
      salary: tSalary,
      leaves: tLeaves
    }),
    [t, tFinance, tAcademicSetup, tSettings, tExams, tSalary, tLeaves]
  );

  const navGroups = useMemo(
    () => visibleDashboardNavGroups(permissions),
    [permissions]
  );

  const brand = useSchoolBrand();
  const brandName = brand.data?.schoolName?.trim() || tenantSlug;
  const prefetchNav = useNavPrefetch();

  const navPrefetchHandlers = useCallback(
    (href: string) => ({
      onMouseEnter: () => prefetchNav(href),
      onFocus: () => prefetchNav(href)
    }),
    [prefetchNav]
  );

  const [expandedModules, setExpandedModules] = useState<Set<DashboardNavKey>>(
    () => new Set()
  );

  useEffect(() => {
    const activeModule = moduleExpandedForPath(pathname, navGroups, permissions);
    setExpandedModules(activeModule ? new Set([activeModule]) : new Set());
  }, [pathname, navGroups, permissions]);

  const expandModule = useCallback((key: DashboardNavKey) => {
    setExpandedModules(new Set([key]));
  }, []);

  const toggleModule = useCallback((key: DashboardNavKey) => {
    setExpandedModules((prev) => {
      if (prev.has(key)) {
        return new Set();
      }
      return new Set([key]);
    });
  }, []);

  function isSimpleItemActive(item: DashboardNavItem): boolean {
    return item.href === "/dashboard"
      ? pathname === item.href
      : pathname.startsWith(item.href);
  }

  function handleNavClick(label: string, href: string) {
    resetNavigationTrail([{ label, href }]);
    onNavigate?.();
  }

  function renderSubmoduleLink(item: NavSubmoduleDef) {
    const active = isSubmoduleActive(pathname, item);
    const label = submoduleLabel(translators, item);

    return (
      <Link
        key={item.href}
        href={item.href}
        className={
          active
            ? "dash-nav-sublink dash-nav-lane dash-nav-sublink--active"
            : "dash-nav-sublink dash-nav-lane"
        }
        onClick={() => handleNavClick(label, item.href)}
        {...navPrefetchHandlers(item.href)}
      >
        <span className="dash-nav-caret-spacer" aria-hidden />
        <Icon name={item.icon} className="dash-nav-sublink__icon" />
        <span className="dash-nav-sublink__label">{label}</span>
      </Link>
    );
  }

  function renderFlyoutGroups(
    groups: NavSubmoduleGroupDef[],
    moduleLabel: string
  ) {
    return (
      <>
        <div className="pds-type-body-m-bold dash-nav-flyout__title">{moduleLabel}</div>
        {groups.map((group) => {
          const groupLabel = subgroupLabel(translators, group);
          return (
            <div
              className="dash-nav-flyout__group"
              key={groupLabel ?? group.items[0]?.href}
            >
              {groupLabel ? (
                <span className="pds-type-caption-s dash-nav-flyout__group-label">
                  {groupLabel}
                </span>
              ) : null}
              {group.items.map((subitem) => {
                const label = submoduleLabel(translators, subitem);
                const active = isSubmoduleActive(pathname, subitem);
                return (
                  <DropdownMenu.Item key={subitem.href} asChild>
                    <Link
                      href={subitem.href}
                      className={
                        active
                          ? "dash-nav-flyout__link dash-nav-flyout__link--active"
                          : "dash-nav-flyout__link"
                      }
                      onClick={() => handleNavClick(label, subitem.href)}
                      {...navPrefetchHandlers(subitem.href)}
                    >
                      <Icon name={subitem.icon} className="dash-nav-flyout__icon" />
                      <span>{label}</span>
                    </Link>
                  </DropdownMenu.Item>
                );
              })}
            </div>
          );
        })}
      </>
    );
  }

  function renderModuleItem(item: DashboardNavItem) {
    const rawGroups = DASHBOARD_NAV_SUBMODULES[item.key];
    const groups = filterSubmoduleGroups(rawGroups, permissions);
    const hasSubmodules = groups.length > 0;
    const moduleLabel = t(item.key);
    const expanded = expandedModules.has(item.key);
    const moduleActive = hasSubmodules
      ? isModuleWithSubmodulesActive(pathname, item.key, groups)
      : isSimpleItemActive(item);
    const defaultHref = hasSubmodules
      ? (firstSubmoduleHref(groups) ?? item.href)
      : item.href;

    if (hasSubmodules && collapsed) {
      return (
        <div className="dash-nav-module" key={item.key}>
          <div className="dash-nav-lane">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className={
                    moduleActive ? "dash-nav-link dash-nav-link--active" : "dash-nav-link"
                  }
                  aria-label={moduleLabel}
                >
                  <Icon
                    name={NAV_ICONS[item.key]}
                    filled={moduleActive}
                    className="dash-nav-link__icon"
                  />
                </button>
              </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="dash-nav-flyout"
                side="right"
                align="start"
                sideOffset={8}
                collisionPadding={12}
              >
                {renderFlyoutGroups(groups, moduleLabel)}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      );
    }

    if (!hasSubmodules) {
      const link = (
        <Link
          href={item.href}
          className={
            moduleActive ? "dash-nav-link dash-nav-link--active" : "dash-nav-link"
          }
          onClick={() => {
            if (!collapsed) {
              setExpandedModules(new Set());
            }
            handleNavClick(moduleLabel, item.href);
          }}
          {...navPrefetchHandlers(item.href)}
        >
          <Icon
            name={NAV_ICONS[item.key]}
            filled={moduleActive}
            className="dash-nav-link__icon"
          />
          <span className="dash-nav-link__label">{moduleLabel}</span>
        </Link>
      );

      return (
        <div className="dash-nav-item dash-nav-lane" key={item.href}>
          {!collapsed ? <span className="dash-nav-caret-spacer" aria-hidden /> : null}
          {collapsed ? withCollapsedTooltip(collapsed, moduleLabel, link) : link}
        </div>
      );
    }

    return (
      <div className="dash-nav-module" key={item.key}>
        <div
          className={
            moduleActive
              ? "dash-nav-parent dash-nav-lane dash-nav-parent--active"
              : "dash-nav-parent dash-nav-lane"
          }
        >
          {!collapsed ? (
            <button
              type="button"
              className="dash-nav-caret"
              aria-expanded={expanded}
              aria-label={moduleLabel}
              onClick={(event) => {
                event.stopPropagation();
                toggleModule(item.key);
              }}
            >
              <Icon name={expanded ? "expand_more" : "chevron_right"} size={18} />
            </button>
          ) : null}
          <Link
            href={defaultHref}
            className="dash-nav-parent__link"
            onClick={() => {
              expandModule(item.key);
              handleNavClick(moduleLabel, defaultHref);
            }}
            {...navPrefetchHandlers(defaultHref)}
          >
            <Icon
              name={NAV_ICONS[item.key]}
              filled={moduleActive}
              className="dash-nav-link__icon"
            />
            <span className="dash-nav-link__label">{moduleLabel}</span>
          </Link>
        </div>
        {!collapsed && expanded ? (
          <div className="dash-nav-submodules">
            {groups.map((group) => {
              const groupLabel = subgroupLabel(translators, group);
              return (
                <div
                  className="dash-nav-submodule-group"
                  key={groupLabel ?? group.items[0]?.href}
                >
                  {groupLabel ? (
                    <span className="pds-type-caption-s dash-nav-subgroup-label">
                      {groupLabel}
                    </span>
                  ) : null}
                  {group.items.map((subitem) => renderSubmoduleLink(subitem))}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="dash-brand">
        <span className="dash-brand-mark" aria-hidden>
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="dash-brand-mark__img" src={brand.logoUrl} alt="" />
          ) : (
            <span className="dash-brand-mark__dot" />
          )}
        </span>
        <span className="dash-brand-text">
          <span className="pds-type-title-l-extrabold dash-brand-name" title={brandName}>
            {brandName}
          </span>
          <span className="pds-type-label-s-medium dash-brand-sub">{t("brandTagline")}</span>
        </span>
        {headerAction}
      </div>
      <nav className="dash-nav">
        {navGroups.map((group) => (
          <div className="dash-nav-group" key={group.key}>
            <span className="pds-type-caption-s dash-nav-group-label">{t(`group_${group.key}`)}</span>
            {group.items.map((item) => renderModuleItem(item))}
          </div>
        ))}
      </nav>
      <SidebarUserCard
        displayName={displayName}
        roles={roles}
        collapsed={collapsed}
        onSignOut={onSignOut}
      />
    </>
  );
}

export function DashboardSidebar(props: SidebarIdentityProps) {
  const t = useTranslations("nav");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored === "true") {
        setCollapsed(true);
      }
    } catch {
      // Ignore storage errors in private browsing.
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Ignore storage errors.
      }
      return next;
    });
  }, []);

  return (
    <Tooltip.Provider>
      <aside className={collapsed ? "dash-sidebar dash-sidebar--collapsed" : "dash-sidebar"}>
        <SidebarContent
          {...props}
          collapsed={collapsed}
          headerAction={
            <button
              type="button"
              className="dash-sidebar-collapse-btn"
              onClick={toggleCollapsed}
              aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
            >
              <Icon name={collapsed ? "chevron_right" : "chevron_left"} size={20} />
            </button>
          }
        />
      </aside>
    </Tooltip.Provider>
  );
}

/**
 * Off-canvas navigation for small screens (<960px). Reuses the full sidebar
 * content, never collapsed — the desktop collapse preference must not apply here.
 */
export function DashboardSidebarDrawer({
  open,
  onOpenChange,
  ...props
}: SidebarIdentityProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    // Safety net: close whenever the route actually changes.
    onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dash-sidebar-drawer__overlay" />
        <Dialog.Content
          className="dash-sidebar-drawer"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">{t("navigation")}</Dialog.Title>
          <SidebarContent
            {...props}
            collapsed={false}
            onNavigate={close}
            headerAction={
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="dash-sidebar-collapse-btn"
                  aria-label={t("closeNavigation")}
                >
                  <Icon name="close" size={20} />
                </button>
              </Dialog.Close>
            }
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
