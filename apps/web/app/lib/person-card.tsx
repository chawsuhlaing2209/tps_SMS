"use client";

import type { ReactNode } from "react";
import {
  EntityList,
  EntityListItem,
  type EntityListItemProps,
} from "../../components/pds/composites/entity-list";

function deriveInitials(name: string) {
  const parsed = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return parsed || "?";
}

export type PersonCardProps = {
  name: string;
  secondary?: ReactNode;
  initials?: string;
  color?: string;
  href?: string;
  onClick?: () => void;
};

/** @deprecated Use {@link EntityListItem} from PDS. */
export function PersonCard({ name, secondary, initials, color, href, onClick }: PersonCardProps) {
  const props: EntityListItemProps = {
    title: name,
    meta: secondary,
    initials: initials ?? deriveInitials(name),
    nameForColor: name,
    color,
    href,
    onClick,
  };
  return <EntityListItem {...props} />;
}

/** @deprecated Use {@link EntityList} for vertical rosters. */
export function RecordCardGrid({ children }: { children: ReactNode; columns?: number }) {
  return <EntityList>{children}</EntityList>;
}
