"use client";

import Link from "next/link";

type Crumb = { label: string; href?: string };

export function RecordBreadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="pds-type-body-m-medium breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="breadcrumb-item">
          {index > 0 ? <span className="breadcrumb-sep">/</span> : null}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
