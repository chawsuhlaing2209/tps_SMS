"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Fragment, useState } from "react";
import { Icon } from "../../app/lib/material-icon";
import { cn } from "../../lib/utils";

export type RowMoreActionItem = {
  id: string;
  label: string;
  icon?: string;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

type Props = {
  items: RowMoreActionItem[];
  /** Defaults to "More actions". */
  ariaLabel?: string;
  /** `surface` = dark icon on light panels (default). `inverse` = light icon on dark shells. */
  tone?: "surface" | "inverse";
};

/** Icon-only more_vert menu for table rows and list cards. */
export function RowMoreActionsMenu({
  items,
  ariaLabel = "More actions",
  tone = "surface"
}: Props) {
  const [open, setOpen] = useState(false);

  if (!items.length) {
    return null;
  }

  return (
    <span
      data-row-stop
      className={cn("row-more-actions", tone === "inverse" && "row-more-actions--inverse")}
    >
      <DropdownMenu.Root open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="row-more-actions__trigger"
            aria-label={ariaLabel}
            onClick={(event) => {
              // Inside a linked row the anchor's default navigation must not
              // fire; stopPropagation alone doesn't cancel it.
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <Icon name="more_vert" size={20} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="hero-actions-menu"
            align="end"
            sideOffset={6}
            onClick={(event) => event.stopPropagation()}
          >
            {items.map((item, index) => (
              <Fragment key={item.id}>
                {index > 0 ? <DropdownMenu.Separator className="hero-actions-menu__sep" /> : null}
                <DropdownMenu.Item
                  className={[
                    "pds-type-body-m-medium hero-actions-menu__item",
                    item.destructive ? "hero-actions-menu__item--destructive" : null
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={item.disabled}
                  onSelect={(event) => {
                    event.preventDefault();
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {item.icon ? <Icon name={item.icon} size={18} /> : null}
                  {item.label}
                </DropdownMenu.Item>
              </Fragment>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </span>
  );
}
