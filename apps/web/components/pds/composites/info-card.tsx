"use client";

import "../info-card.css";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import { InfoCardBadge } from "../subcomponents/info-card-badge";

export type InfoCardProps = {
  badge?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
};

/** Dark feature / rule callout card for global rules and contextual info (Figma 67:13145). */
export function InfoCard({ badge, title, description, className }: InfoCardProps) {
  const badgeNode =
    typeof badge === "string" ? <InfoCardBadge>{badge}</InfoCardBadge> : badge;

  return (
    <article className={cn("pds-info-card", className)} data-figma-node="67:13145">
      <span className="pds-info-card__glow" aria-hidden />
      <div className="pds-info-card__content">
        {badgeNode}
        <h3 className="pds-type-title-m-extrabold pds-info-card__title">{title}</h3>
        {description ? (
          <div className="pds-type-body-s-regular pds-info-card__description">{description}</div>
        ) : null}
      </div>
    </article>
  );
}
