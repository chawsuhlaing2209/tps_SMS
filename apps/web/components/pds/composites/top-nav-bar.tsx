"use client";

import "./top-nav-bar.css";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import { PdsBreadcrumb, type PdsBreadcrumbItem } from "./breadcrumb";

export type TopNavBarProps = {
  /** Rendered before the breadcrumb region (e.g. mobile menu button). */
  leading?: ReactNode;
  /** Breadcrumb trail items (left). */
  breadcrumbItems?: PdsBreadcrumbItem[];
  /** Custom breadcrumb region; overrides `breadcrumbItems`. */
  breadcrumb?: ReactNode;
  /** Locale, academic year, notifications, etc. (right). */
  utilities?: ReactNode;
  className?: string;
};

/** Dashboard top bar — breadcrumb left, workspace utilities right (Figma 119:9730). */
export function TopNavBar({
  leading,
  breadcrumbItems,
  breadcrumb,
  utilities,
  className,
}: TopNavBarProps) {
  const breadcrumbNode =
    breadcrumb ??
    (breadcrumbItems?.length ? <PdsBreadcrumb items={breadcrumbItems} /> : null);

  if (!breadcrumbNode && !utilities && !leading) {
    return null;
  }

  return (
    <header className={cn("pds-top-nav-bar", className)}>
      <div className="pds-top-nav-bar__inner">
        {leading}
        {breadcrumbNode ? (
          <div className="pds-top-nav-bar__breadcrumb">{breadcrumbNode}</div>
        ) : (
          <span className="pds-top-nav-bar__breadcrumb" aria-hidden />
        )}
        {utilities ? <div className="pds-top-nav-bar__utilities">{utilities}</div> : null}
      </div>
    </header>
  );
}
