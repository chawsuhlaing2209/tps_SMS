"use client";

import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";

export type PdsSearchFiltersRowProps = {
  /** Search + dropdown filters (left cluster, Figma 76:9645). */
  filters: ReactNode;
  /** Status segmented control or similar (right cluster). */
  statusControl?: ReactNode;
  className?: string;
};

/** Horizontal search/filters toolbar — left filters, right status tabs. */
export function PdsSearchFiltersRow({
  filters,
  statusControl,
  className,
}: PdsSearchFiltersRowProps) {
  return (
    <div className={cn("pds-search-filters-row", className)}>
      <div className="pds-search-filters-row__filters">{filters}</div>
      {statusControl ? (
        <div className="pds-search-filters-row__status">{statusControl}</div>
      ) : null}
    </div>
  );
}
