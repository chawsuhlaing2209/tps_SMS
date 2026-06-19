"use client";

import { cn } from "../../../lib/utils";

export type DetailCardAvatarTone = "student" | "teacher" | "custom";

export type DetailCardAvatarProps = {
  initials: string;
  tone?: DetailCardAvatarTone;
  /** Used when `tone` is `custom`. */
  background?: string;
  className?: string;
};

/** 72px rounded-square avatar for DetailCard profile heroes. */
export function DetailCardAvatar({
  initials,
  tone = "teacher",
  background,
  className,
}: DetailCardAvatarProps) {
  const style = tone === "custom" && background ? { background } : undefined;

  return (
    <span
      className={cn(
        "pds-detail-card-avatar",
        tone === "student" && "pds-detail-card-avatar--student",
        tone === "teacher" && "pds-detail-card-avatar--teacher",
        className
      )}
      style={style}
      aria-hidden
    >
      <span className="pds-detail-card-avatar__initials">{initials}</span>
    </span>
  );
}
