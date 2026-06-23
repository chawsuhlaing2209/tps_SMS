"use client";

import type { ReactNode } from "react";
import { Icon } from "../../../app/lib/material-icon";
import { cn } from "../../../lib/utils";
import { Toggle } from "../../shared/toggle";
import "./toggle-list.css";

export type ToggleListIconTone = "locked" | "info" | "success" | "warning" | "error" | "default";

export function formatToggleListAmount(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

export function resolveToggleListIconTone(icon: string, kind?: string): ToggleListIconTone {
  const name = icon.toLowerCase();

  if (kind === "deduction" || name.includes("health") || name.includes("safety") || name.includes("remove")) {
    return "error";
  }
  if (name.includes("bus") || name.includes("direction") || name.includes("transport")) {
    return "success";
  }
  if (name.includes("restaurant") || name.includes("meal") || name.includes("emoji_events") || name.includes("trophy")) {
    return "warning";
  }
  if (name.includes("bed") || name.includes("home") || name.includes("house") || name.includes("payments")) {
    return "info";
  }

  return "default";
}

type ToggleListPriceProps = {
  amount: number;
  currency?: string;
};

function ToggleListPrice({ amount, currency = "MMK" }: ToggleListPriceProps) {
  return (
    <span className="pds-toggle-list__price">
      <span className="pds-type-body-m-bold pds-toggle-list__price-value">{formatToggleListAmount(amount)}</span>
      <span className="pds-type-caption-s pds-toggle-list__price-currency">{currency}</span>
    </span>
  );
}

type ToggleListItemBaseProps = {
  title: ReactNode;
  amount: number;
  currency?: string;
  className?: string;
};

export type ToggleListLockedItemProps = ToggleListItemBaseProps & {
  variant: "locked";
  description?: ReactNode;
};

export type ToggleListToggleItemProps = ToggleListItemBaseProps & {
  variant: "toggle";
  icon: string;
  iconTone?: ToggleListIconTone;
  description?: ReactNode;
  checked: boolean;
  readOnly?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  ariaLabel?: string;
};

export type ToggleListExpandableItemProps = {
  variant: "expandable";
  icon: string;
  iconTone?: ToggleListIconTone;
  title: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  children?: ReactNode;
  ariaLabel?: string;
  className?: string;
};

export type ToggleListItemProps =
  | ToggleListLockedItemProps
  | ToggleListToggleItemProps
  | ToggleListExpandableItemProps;

export function ToggleListItem(props: ToggleListItemProps) {
  if (props.variant === "expandable") {
    const {
      icon,
      iconTone = resolveToggleListIconTone(icon),
      title,
      description,
      checked,
      onCheckedChange,
      children,
      ariaLabel,
      className,
    } = props;

    return (
      <li
        className={cn(
          "pds-toggle-list__item pds-toggle-list__item--expandable",
          checked && "pds-toggle-list__item--expandable-active",
          className,
        )}
      >
        <div className="pds-toggle-list__expandable-head">
          <span
            className={cn("pds-toggle-list__icon", `pds-toggle-list__icon--${iconTone}`)}
            aria-hidden
          >
            <Icon name={icon} size={18} />
          </span>
          <div className="pds-toggle-list__copy">
            <p className="pds-toggle-list__title">{title}</p>
            {description ? (
              <p className="pds-type-body-s-regular pds-toggle-list__description">{description}</p>
            ) : null}
          </div>
          <Toggle
            className="pds-toggle-list__toggle"
            checked={checked}
            aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)}
            onCheckedChange={onCheckedChange}
          />
        </div>
        {checked && children ? (
          <div className="pds-toggle-list__expandable-body">{children}</div>
        ) : null}
      </li>
    );
  }

  if (props.variant === "locked") {
    const { title, description, amount, currency, className } = props;

    return (
      <li className={cn("pds-toggle-list__item pds-toggle-list__item--locked", className)}>
        <span className="pds-toggle-list__icon pds-toggle-list__icon--locked" aria-hidden>
          <Icon name="lock" size={19} />
        </span>
        <div className="pds-toggle-list__copy">
          <p className="pds-toggle-list__title">{title}</p>
          {description ? (
            <p className="pds-type-body-s-regular pds-toggle-list__description">{description}</p>
          ) : null}
        </div>
        <ToggleListPrice amount={amount} currency={currency} />
      </li>
    );
  }

  const {
    icon,
    iconTone = resolveToggleListIconTone(icon),
    title,
    description,
    amount,
    currency,
    checked,
    readOnly = false,
    onCheckedChange,
    ariaLabel,
    className,
  } = props;

  return (
    <li
      className={cn(
        "pds-toggle-list__item",
        checked ? "pds-toggle-list__item--enabled" : "pds-toggle-list__item--disabled",
        className,
      )}
    >
      <span
        className={cn("pds-toggle-list__icon", `pds-toggle-list__icon--${iconTone}`)}
        aria-hidden
      >
        <Icon name={icon} size={18} />
      </span>
      <div className="pds-toggle-list__copy">
        <div className="pds-toggle-list__copy-row">
          <p className="pds-toggle-list__title">{title}</p>
          <ToggleListPrice amount={amount} currency={currency} />
        </div>
        {description ? (
          <p className="pds-type-body-s-regular pds-toggle-list__description">{description}</p>
        ) : null}
      </div>
      <Toggle
        className="pds-toggle-list__toggle"
        checked={checked}
        disabled={readOnly}
        aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)}
        onCheckedChange={onCheckedChange}
      />
    </li>
  );
}

export function ToggleList({
  children,
  className,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <ul className={cn("pds-toggle-list", className)} aria-label={ariaLabel}>
      {children}
    </ul>
  );
}

export function ToggleListSectionHead({
  title,
  summary,
  className,
}: {
  title: ReactNode;
  summary?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("pds-toggle-list-section__head", className)}>
      <p className="pds-type-caption-s pds-toggle-list-section__title">{title}</p>
      {summary ? <p className="pds-type-body-s-semibold pds-toggle-list-section__summary">{summary}</p> : null}
    </div>
  );
}
