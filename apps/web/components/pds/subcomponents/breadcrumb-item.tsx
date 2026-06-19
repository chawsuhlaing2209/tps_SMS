"use client";

import Link from "next/link";
import { Icon } from "../../../app/lib/material-icon";
import { cn } from "../../../lib/utils";

export type BreadcrumbItemProps = {
  label: string;
  href?: string;
  /** Last item in the trail — no trailing separator. */
  current?: boolean;
};

/** Single breadcrumb segment (Figma 67:14072). */
export function BreadcrumbItem({ label, href, current = false }: BreadcrumbItemProps) {
  return (
    <span className="pds-breadcrumb__item">
      {href && !current ? (
        <Link href={href} className={cn("pds-type-body-s-semibold pds-breadcrumb__link pds-breadcrumb__label")}>
          {label}
        </Link>
      ) : (
        <span className="pds-type-body-s-semibold pds-breadcrumb__label">{label}</span>
      )}
      {!current ? (
        <Icon name="arrow_right" size={14} className="pds-breadcrumb__separator" aria-hidden />
      ) : null}
    </span>
  );
}
