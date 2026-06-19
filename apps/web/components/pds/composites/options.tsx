"use client";

import * as React from "react";
import { Button } from "../../ui/button";
import { OptionItem, type OptionItemVariant } from "./option-item";
import { cn } from "../../../lib/utils";

export type OptionsItem = {
  id: string;
  label: string;
  value?: string;
  selected?: boolean;
};

export type OptionsProps = {
  items: OptionsItem[];
  variant?: OptionItemVariant;
  hasFooter?: boolean;
  /** When true, panel stretches to parent width (default 200px standalone). */
  fillWidth?: boolean;
  className?: string;
  onItemSelect?: (id: string) => void;
  onClear?: () => void;
  onOkay?: () => void;
  clearLabel?: string;
  okayLabel?: string;
};

const MAX_HEIGHT: Record<number, string> = {
  3: "126px",
  5: "210px",
  7: "294px",
  9: "320px",
  11: "320px",
};

function resolvePanelHeight(count: number) {
  if (count <= 3) return MAX_HEIGHT[3];
  if (count <= 5) return MAX_HEIGHT[5];
  if (count <= 7) return MAX_HEIGHT[7];
  return MAX_HEIGHT[9];
}

/** Dropdown list panel — Figma node 35:13598.
 *  Standalone reusable: popovers, filter menus, action sheets, or inside PdsSelect.
 *  Composes OptionItem rows and optional Button footer — not exclusive to Select. */
export function Options({
  items,
  variant = "default",
  hasFooter = false,
  fillWidth = false,
  className,
  onItemSelect,
  onClear,
  onOkay,
  clearLabel = "Clear",
  okayLabel = "Okay",
}: OptionsProps) {
  const scrollable = items.length > 5;
  const showFooter = hasFooter && items.length >= 7;

  return (
    <div
      className={cn(
        "pds-options",
        fillWidth && "pds-options--fill",
        scrollable && "pds-options--scrollable",
        showFooter && "pds-options--with-footer",
        className
      )}
      data-figma-node="35:13598"
      style={{ maxHeight: resolvePanelHeight(items.length) }}
      role="listbox"
    >
      <div className="pds-options__list">
        {items.map((item, index) => (
          <OptionItem
            key={item.id}
            variant={variant}
            isSelected={item.selected}
            hasDivider={index < items.length - 1}
            hasValue={variant === "default" && Boolean(item.value)}
            valueText={item.value}
            label={item.label}
            onSelect={() => onItemSelect?.(item.id)}
          />
        ))}
      </div>
      {scrollable ? <div className="pds-options__scrollbar" aria-hidden="true" /> : null}
      {showFooter ? (
        <div className="pds-options__footer">
          <Button
            type="button"
            buttonType="ghost"
            buttonColor="primary"
            className="pds-type-body-m-medium pds-btn--text-link"
            onClick={onClear}
          >
            {clearLabel}
          </Button>
          <Button type="button" buttonType="filled" buttonColor="secondary" onClick={onOkay}>
            {okayLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
