"use client";

import "../breadcrumb.css";
import { cn } from "../../../lib/utils";
import { BreadcrumbItem } from "../subcomponents/breadcrumb-item";

export type PdsBreadcrumbItem = {
  label: string;
  href?: string;
};

export type PdsBreadcrumbProps = {
  items: PdsBreadcrumbItem[];
  className?: string;
  "aria-label"?: string;
};

/** Breadcrumb trail — 2–5 items with arrow separators (Figma 67:14078). */
export function PdsBreadcrumb({ items, className, "aria-label": ariaLabel = "Breadcrumb" }: PdsBreadcrumbProps) {
  if (!items.length) return null;

  return (
    <nav className={cn("pds-breadcrumb", className)} aria-label={ariaLabel} data-figma-node="67:14078">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <BreadcrumbItem
            key={`${item.label}-${index}`}
            label={item.label}
            href={item.href}
            current={isLast}
          />
        );
      })}
    </nav>
  );
}
