"use client";

import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function AcademicsBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="breadcrumbs__item">
            {index > 0 ? <span className="breadcrumbs__sep">›</span> : null}
            {item.href && !isLast ? (
              <Link href={item.href} className="breadcrumbs__link">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "breadcrumbs__current" : "breadcrumbs__text"}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
