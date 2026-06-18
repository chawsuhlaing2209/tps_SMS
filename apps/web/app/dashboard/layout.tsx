"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Icon } from "../lib/icon";
import { type DashboardNavKey, visibleDashboardNavGroups } from "../lib/permissions";
import { clearSession } from "../lib/session";
import { useWorkspace } from "../lib/use-workspace";
import { DashboardTopbar } from "./dashboard-topbar";
import { PageHeaderProvider } from "./page-header-context";
import { SidebarUserCard } from "./sidebar-user-card";

const NAV_ICONS: Record<DashboardNavKey, string> = {
  overview: "grid_view",
  students: "school",
  teachers: "co_present",
  structure: "account_tree",
  academicSetup: "school",
  admissions: "how_to_reg",
  enrollments: "school",
  calendar: "calendar_month",
  timetable: "calendar_view_week",
  exams: "grading",
  finance: "account_balance_wallet",
  salary: "payments",
  communication: "forum",
  audit: "history",
  settings: "settings",
  team: "groups",
  departments: "corporate_fare"
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { session, ready } = useWorkspace();

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (!session) {
      router.replace("/");
      return;
    }
    if (session.isPlatform || session.tenantId === null) {
      router.replace("/platform/tenants");
    }
  }, [ready, router, session]);

  if (!ready || !session || session.isPlatform || session.tenantId === null) {
    return (
      <div className="dash-loading">
        <span>{t("loadingWorkspace")}</span>
      </div>
    );
  }

  const navGroups = visibleDashboardNavGroups(session.permissions);

  async function handleSignOut() {
    try {
      if (session?.tenantId) {
        await fetch(`/api/tenants/${encodeURIComponent(session.tenantId)}/auth/logout`, {
          method: "POST",
          credentials: "include"
        });
      }
    } catch {
      // Clearing local state below still signs the user out of the browser.
    } finally {
      clearSession();
      router.replace("/");
    }
  }

  return (
    <PageHeaderProvider>
      <div className="dash">
        <aside className="dash-sidebar">
          <div className="dash-brand">
            <span className="dash-brand-mark" aria-hidden>
              <span className="dash-brand-mark__dot" />
            </span>
            <span className="dash-brand-text">
              <span className="dash-brand-name">{session.tenantSlug}</span>
              <span className="dash-brand-sub">{t("brandTagline")}</span>
            </span>
          </div>
          <nav className="dash-nav">
            {navGroups.map((group) => (
              <div className="dash-nav-group" key={group.key}>
                <span className="dash-nav-group-label">{t(`group_${group.key}`)}</span>
                {group.items.map((item) => {
                  const active =
                    item.href === "/dashboard"
                      ? pathname === item.href
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={active ? "dash-nav-link dash-nav-link--active" : "dash-nav-link"}
                    >
                      <Icon
                        name={NAV_ICONS[item.key]}
                        filled={active}
                        className="dash-nav-link__icon"
                      />
                      <span className="dash-nav-link__label">{t(item.key)}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <SidebarUserCard
            displayName={session.displayName ?? t("signedIn")}
            roles={session.roles}
            onSignOut={() => void handleSignOut()}
          />
        </aside>

        <div className="dash-main">
          <DashboardTopbar />
          <div className="dash-content">{children}</div>
        </div>
      </div>
    </PageHeaderProvider>
  );
}
