"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Fragment, useState, type ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { Icon } from "./material-icon";

export type HeroMoreActionItem = {
  id: string;
  label: string;
  icon?: string;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

function MoreActionsMenu({
  items,
  trigger
}: {
  items: HeroMoreActionItem[];
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (!items.length) {
    return null;
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="hero-actions-menu" align="end" sideOffset={8}>
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
                onSelect={() => {
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
  );
}

/** Outline pill trigger + white menu for secondary actions on dark hero banners. */
export function HeroMoreActionsMenu({
  label,
  items
}: {
  label: string;
  items: HeroMoreActionItem[];
}) {
  return (
    <MoreActionsMenu
      items={items}
      trigger={
        <button type="button" className="pds-type-body-m-medium btn-hero-outline">
          {label}
          <Icon name="expand_more" size={18} />
        </button>
      }
    />
  );
}

/** Secondary outlined trigger + white menu for secondary actions on light panel toolbars. */
export function PanelMoreActionsMenu({
  label,
  items
}: {
  label: string;
  items: HeroMoreActionItem[];
}) {
  return (
    <MoreActionsMenu
      items={items}
      trigger={
        <Button buttonType="outlined" buttonColor="secondary" suffixIcon="expand_more">
          {label}
        </Button>
      }
    />
  );
}

/** Primary lime CTA for dark hero banners. */
export function HeroPrimaryAction({
  href,
  onClick,
  children
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const className = "pds-type-body-m-bold btn-hero-primary";
  if (href) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}

/** Secondary outline action for dark hero banners (links or buttons). */
export function HeroOutlineAction({
  href,
  onClick,
  children
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const className = "btn-hero-outline";
  if (href) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}
