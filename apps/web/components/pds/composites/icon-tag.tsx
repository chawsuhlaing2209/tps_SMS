"use client";

import type { ReactNode } from "react";
import { Icon } from "../../../app/lib/material-icon";
import { cn } from "../../../lib/utils";

export type IconTagOption = {
  id: string;
  label: string;
  icon: string;
};

export type IconTagProps = {
  label: ReactNode;
  icon: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};

/** Pill tag with leading icon — inactive sage tint, active forest fill (Figma 97:28876). */
export function IconTag({ label, icon, active, disabled, onClick, className }: IconTagProps) {
  return (
    <button
      type="button"
      className={cn("pds-icon-tag", active && "pds-icon-tag--active", className)}
      disabled={disabled}
      role="tab"
      aria-selected={active}
      onClick={onClick}
    >
      <Icon name={icon} size={18} />
      <span className="pds-type-body-s-bold">{label}</span>
    </button>
  );
}

export function IconTagGroup({
  children,
  className,
  ariaLabel
}: {
  children: ReactNode;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <div className={cn("pds-icon-tag-group", className)} role="tablist" aria-label={ariaLabel}>
      {children}
    </div>
  );
}

export type IconTagControlProps = {
  options: IconTagOption[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
};

/** Mutually exclusive icon tag row — drop-in for SegmentedControl on benefits-style tabs. */
export function IconTagControl({ options, value, onChange, ariaLabel, className }: IconTagControlProps) {
  return (
    <IconTagGroup ariaLabel={ariaLabel} className={className}>
      {options.map((option) => (
        <IconTag
          key={option.id}
          label={option.label}
          icon={option.icon}
          active={option.id === value}
          onClick={() => {
            if (option.id !== value) onChange(option.id);
          }}
        />
      ))}
    </IconTagGroup>
  );
}
