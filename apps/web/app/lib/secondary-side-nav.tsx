"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "./material-icon";

export type SecondaryNavItem = {
  href: string;
  label: string;
  icon: string;
  /** Match pathname exactly (for module index routes). */
  exact?: boolean;
};

export type SecondaryNavGroup = {
  label?: string;
  items: SecondaryNavItem[];
};

function isItemActive(pathname: string, item: SecondaryNavItem): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function moduleBasePath(groups: SecondaryNavGroup[]): string | undefined {
  const firstHref = groups.flatMap((group) => group.items)[0]?.href;
  if (!firstHref) return undefined;

  const segments = firstHref.split("/").filter(Boolean);
  if (segments.length < 2) return `/${segments.join("/")}`;
  return `/${segments[0]}/${segments[1]}`;
}

function resolveActiveHref(pathname: string, groups: SecondaryNavGroup[]): string | undefined {
  const items = groups.flatMap((group) => group.items);
  if (!items.length) return undefined;

  const matched = items.filter((item) => isItemActive(pathname, item));
  if (matched.length) {
    return matched.reduce((best, item) =>
      item.href.length > best.href.length ? item : best
    ).href;
  }

  const moduleRoot = moduleBasePath(groups);
  if (moduleRoot && (pathname === moduleRoot || pathname === `${moduleRoot}/`)) {
    return items[0]?.href;
  }

  return undefined;
}

export function SecondarySideNav({
  groups
}: {
  groups: SecondaryNavGroup[];
}) {
  const pathname = usePathname();
  const activeHref = resolveActiveHref(pathname, groups);

  return (
    <aside className="secondary-side-nav" aria-label="Section navigation">
      {groups.map((group) => (
        <div className="secondary-side-nav__group" key={group.label ?? group.items[0]?.href}>
          {group.label ? (
            <span className="pds-type-caption-s secondary-side-nav__label">{group.label}</span>
          ) : null}
          {group.items.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "pds-type-body-m-bold secondary-side-nav__link secondary-side-nav__link--active"
                    : "pds-type-body-m-medium secondary-side-nav__link"
                }
              >
                <Icon name={item.icon} className="secondary-side-nav__icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
}

export function ModuleShell({
  nav,
  children
}: {
  nav: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="module-shell">
      {nav}
      <div className="module-shell__content">{children}</div>
    </div>
  );
}
