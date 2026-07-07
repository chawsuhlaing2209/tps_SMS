"use client";

import * as React from "react";
import { Icon } from "../../../app/lib/material-icon";
import { cn } from "../../../lib/utils";
import { type OptionsItem, type OptionsProps } from "./options";
import { SelectItemPosition } from "./select-item-position";
import { registerOpenSelect, unregisterOpenSelect } from "./select-open-coordinator";
import type { OptionItemVariant } from "./option-item";

export type PdsSelectVariant = "form" | "filter";
/** Manual overrides; `selected` is derived automatically when a value is set. */
export type PdsSelectState = "idle" | "focus" | "selected" | "error" | "disabled";

export type PdsSelectProps = {
  variant?: PdsSelectVariant;
  state?: PdsSelectState;
  multiple?: boolean;
  searchable?: boolean;
  placeholder?: string;
  value?: string | string[];
  /** Initial value when uncontrolled. */
  defaultValue?: string | string[];
  items: OptionsItem[];
  optionVariant?: OptionItemVariant;
  hasFooter?: boolean;
  panelPosition?: "top" | "bottom";
  className?: string;
  onValueChange?: (value: string | string[]) => void;
  /** Fired when the searchable input changes (for async option loading). */
  onSearchChange?: (query: string) => void;
  onClear?: () => void;
  onOkay?: () => void;
  /** Shown when `items` is empty (e.g. no catalog rows for this filter). */
  emptyLabel?: string;
};

function displayValue(
  items: OptionsItem[],
  value: string | string[] | undefined,
  placeholder: string,
  multiple: boolean
) {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) return placeholder;
  if (multiple && Array.isArray(value)) {
    const labels = items
      .filter((item) => value.includes(item.id))
      .map((item) => item.label);
    return labels.join(", ") || placeholder;
  }
  if (typeof value === "string") {
    const selected = items.find((item) => item.id === value);
    if (selected) return selected.label;
  }
  return placeholder;
}

function hasSelection(
  value: string | string[] | undefined,
  multiple: boolean,
  items: OptionsItem[]
) {
  if (multiple) return Array.isArray(value) && value.length > 0;
  if (typeof value !== "string") return false;
  if (value.length > 0) return true;
  return items.some((item) => item.id === "");
}

/** Full select field — Figma node 35:12158.
 *  One assembly that composes trigger + SelectItemPosition + Options.
 *  Options and Button remain independently importable for other surfaces. */
export function PdsSelect({
  variant = "form",
  state = "idle",
  multiple = false,
  searchable = false,
  placeholder = "Select",
  value,
  defaultValue,
  items,
  optionVariant = "default",
  hasFooter = false,
  panelPosition = "bottom",
  className,
  onValueChange,
  onSearchChange,
  onClear,
  onOkay,
  emptyLabel,
}: PdsSelectProps) {
  const selectId = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const panelContainerRef = React.useRef<HTMLDivElement>(null);
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string | string[]>(
    defaultValue ?? (multiple ? [] : "")
  );
  const currentValue = isControlled ? value : uncontrolledValue;

  const [open, setOpen] = React.useState(state === "focus");
  const [search, setSearch] = React.useState("");
  const disabled = state === "disabled";
  const selected = hasSelection(currentValue, multiple, items);

  const closePanel = React.useCallback(() => {
    unregisterOpenSelect(selectId);
    setOpen(false);
    setSearch("");
  }, [selectId]);

  const openPanel = React.useCallback(() => {
    registerOpenSelect(selectId, closePanel);
    setOpen(true);
  }, [selectId, closePanel]);

  React.useEffect(() => {
    return () => unregisterOpenSelect(selectId);
  }, [selectId]);

  // Panel is portaled out of the trigger's subtree, so close on clicks outside
  // both the trigger and the portaled panel.
  React.useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelContainerRef.current?.contains(target)) return;
      closePanel();
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, closePanel]);

  const togglePanel = React.useCallback(() => {
    if (disabled) return;
    if (open) {
      closePanel();
    } else {
      openPanel();
    }
  }, [disabled, open, closePanel, openPanel]);

  const visualState: PdsSelectState =
    state === "disabled" || state === "error"
      ? state
      : open
        ? "focus"
        : selected
          ? "selected"
          : "idle";

  const selectedIds = React.useMemo(() => {
    if (multiple) return Array.isArray(currentValue) ? currentValue : [];
    return typeof currentValue === "string" && currentValue ? [currentValue] : [];
  }, [multiple, currentValue]);

  const filteredItems = React.useMemo(() => {
    if (!searchable || !search.trim() || onSearchChange) return items;
    const query = search.trim().toLowerCase();
    return items.filter((item) => item.label.toLowerCase().includes(query));
  }, [items, searchable, search, onSearchChange]);

  const optionsItems = filteredItems.map((item) => ({
    ...item,
    selected: selectedIds.includes(item.id),
  }));

  const commitValue = (next: string | string[]) => {
    if (!isControlled) {
      setUncontrolledValue(next);
    }
    onValueChange?.(next);
  };

  const handleSelect = (id: string) => {
    if (disabled) return;
    if (multiple) {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((entry) => entry !== id)
        : [...selectedIds, id];
      commitValue(next);
      return;
    }
    commitValue(id);
    closePanel();
  };

  const optionsProps: OptionsProps = {
    items: optionsItems,
    variant: optionVariant,
    hasFooter,
    onItemSelect: handleSelect,
    onClear: () => {
      onClear?.();
      commitValue(multiple ? [] : "");
    },
    onOkay: () => {
      onOkay?.();
      closePanel();
    },
    emptyLabel,
  };

  const showingPlaceholder = !selected;

  return (
    <div
      ref={rootRef}
      className={cn(
        "pds-select",
        variant === "form" && "pds-select--form",
        variant === "filter" && "pds-select--filter",
        className
      )}
      data-figma-node="35:12158"
      data-variant={variant}
      data-state={visualState}
      data-multiple={multiple ? "yes" : "no"}
      data-searchable={searchable ? "yes" : "no"}
    >
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        className={cn(
          "pds-type-body-m-medium pds-select__trigger",
          `pds-select__trigger--${variant}`,
          visualState === "focus" && "pds-select__trigger--focus",
          visualState === "error" && "pds-select__trigger--error",
          visualState === "disabled" && "pds-select__trigger--disabled",
          visualState === "selected" && "pds-select__trigger--selected"
        )}
        onClick={togglePanel}
      >
        {searchable && open ? (
          <input
            className="pds-select__search"
            value={search}
            placeholder={placeholder}
            onChange={(event) => {
              const next = event.target.value;
              setSearch(next);
              onSearchChange?.(next);
            }}
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <span
            className={cn(
              "pds-select__value",
              showingPlaceholder && "pds-select__value--placeholder"
            )}
          >
            {displayValue(items, currentValue, placeholder, multiple)}
          </span>
        )}
        <Icon name={open ? "expand_less" : "expand_more"} size={20} />
      </button>
      <SelectItemPosition
        position={panelPosition}
        open={open}
        anchorRef={rootRef}
        containerRef={panelContainerRef}
        optionsProps={optionsProps}
      />
    </div>
  );
}
