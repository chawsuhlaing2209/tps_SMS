"use client";

import "../detail-card.css";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import { DetailCardAvatar, type DetailCardAvatarProps } from "../subcomponents/detail-card-avatar";
import { DetailCardStatus } from "../subcomponents/detail-card-status";
import { DetailCardTag, type DetailCardTagProps } from "../subcomponents/detail-card-tag";

export type DetailCardTagItem = Pick<DetailCardTagProps, "label" | "icon"> & { id: string };

export type DetailCardProps = {
  /** Avatar initials + tone, or a custom avatar node. */
  avatar: Pick<DetailCardAvatarProps, "initials" | "tone" | "background"> | ReactNode;
  title: ReactNode;
  /** Optional status chip beside the title (string or custom node). */
  status?: ReactNode;
  meta?: ReactNode;
  tags?: DetailCardTagItem[] | ReactNode;
  actions?: ReactNode;
  className?: string;
};

function renderAvatar(avatar: DetailCardProps["avatar"]) {
  if (avatar && typeof avatar === "object" && "initials" in avatar) {
    return <DetailCardAvatar {...avatar} />;
  }
  return avatar;
}

function renderTags(tags: DetailCardProps["tags"]) {
  if (!tags) return null;
  if (Array.isArray(tags)) {
    if (!tags.length) return null;
    return (
      <div className="pds-detail-card__tags">
        {tags.map((tag) => (
          <DetailCardTag key={tag.id} label={tag.label} icon={tag.icon} />
        ))}
      </div>
    );
  }
  return <div className="pds-detail-card__tags">{tags}</div>;
}

/** Ink-green profile / entity hero — students, teachers, academic structure (Figma 75:9199). */
export function DetailCard({ avatar, title, status, meta, tags, actions, className }: DetailCardProps) {
  const statusNode =
    typeof status === "string" ? <DetailCardStatus>{status}</DetailCardStatus> : status;

  return (
    <section className={cn("pds-detail-card", className)} data-figma-node="75:9199">
      <div className="pds-detail-card__main">
        {renderAvatar(avatar)}
        <div className="pds-detail-card__body">
          <div className="pds-detail-card__title-row">
            <h2 className="pds-type-title-xl-extrabold pds-detail-card__title">{title}</h2>
            {statusNode}
          </div>
          {meta ? (
            <div className="pds-type-body-s-regular pds-detail-card__meta">{meta}</div>
          ) : null}
          {renderTags(tags)}
        </div>
      </div>
      {actions ? <div className="pds-detail-card__actions">{actions}</div> : null}
    </section>
  );
}
