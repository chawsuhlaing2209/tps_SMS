"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useLiveApiQuery } from "../lib/api";
import { Icon } from "../lib/material-icon";
import { formatMMK } from "../lib/money";

const SEEN_KEY = "pds-notifications-seen-at";

type NotificationItem = {
  id: string;
  type: "discountRequest" | "paymentUnverified" | "newEnquiry";
  name: string;
  amount: number | null;
  href: string;
  createdAt: string;
};

const TYPE_ICONS: Record<NotificationItem["type"], string> = {
  discountRequest: "percent",
  paymentUnverified: "account_balance",
  newEnquiry: "how_to_reg"
};

function formatWhen(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/** Top-bar notifications bell: actionable work queues, dot for unseen items. */
export function NotificationsBell() {
  const t = useTranslations("nav");
  const router = useRouter();
  const [seenAt, setSeenAt] = useState<string | null>(null);

  useEffect(() => {
    try {
      setSeenAt(localStorage.getItem(SEEN_KEY));
    } catch {
      // Private browsing — dot simply stays on while items exist.
    }
  }, []);

  const notifications = useLiveApiQuery<{ items: NotificationItem[]; total: number }>(
    (tenant) => `/tenants/${tenant}/dashboard/notifications`
  );

  const items = notifications.data?.items ?? [];
  const newestAt = items[0]?.createdAt ?? null;
  const hasUnseen = Boolean(newestAt && (!seenAt || newestAt > seenAt));

  const markSeen = useCallback(() => {
    if (!newestAt) return;
    setSeenAt(newestAt);
    try {
      localStorage.setItem(SEEN_KEY, newestAt);
    } catch {
      // Ignore storage errors.
    }
  }, [newestAt]);

  const itemLabel = (item: NotificationItem): string => {
    const name = item.name || "—";
    switch (item.type) {
      case "discountRequest":
        return t("notifDiscountRequest", { name });
      case "paymentUnverified":
        return t("notifPaymentUnverified", { name, amount: formatMMK(item.amount ?? 0) });
      case "newEnquiry":
        return t("notifNewEnquiry", { name });
    }
  };

  return (
    <DropdownMenu.Root
      onOpenChange={(open) => {
        if (open) markSeen();
      }}
    >
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="pds-top-nav-bar__notifications"
          aria-label={t("notifications")}
        >
          <Icon name="notifications" size={20} />
          {hasUnseen ? <span className="pds-top-nav-bar__notifications-dot" aria-hidden /> : null}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="notif-menu"
          align="end"
          sideOffset={8}
          collisionPadding={12}
        >
          <div className="pds-type-body-m-bold notif-menu__title">{t("notifications")}</div>
          {items.length === 0 ? (
            <p className="pds-type-body-s-regular muted notif-menu__empty">
              {t("notificationsEmpty")}
            </p>
          ) : (
            items.map((item) => (
              <DropdownMenu.Item key={item.id} asChild>
                <button
                  type="button"
                  className="notif-menu__item"
                  onClick={() => router.push(item.href)}
                >
                  <span className="notif-menu__icon">
                    <Icon name={TYPE_ICONS[item.type]} size={18} />
                  </span>
                  <span className="notif-menu__body">
                    <span className="pds-type-body-s-medium notif-menu__label">
                      {itemLabel(item)}
                    </span>
                    <span className="pds-type-caption-s muted notif-menu__when">
                      {formatWhen(item.createdAt)}
                    </span>
                  </span>
                </button>
              </DropdownMenu.Item>
            ))
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
