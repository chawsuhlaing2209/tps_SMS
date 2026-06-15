"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { LanguageSwitcher } from "../lib/language-switcher";
import { visibleDashboardNav } from "../lib/permissions";
import { clearSession } from "../lib/session";
import { useWorkspace } from "../lib/use-workspace";

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

  const navItems = visibleDashboardNav(session.permissions);

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
    <div className="dash">
      <aside className="dash-sidebar">
        <div className="dash-brand">
          <span className="dash-brand-mark">SMS</span>
          <span className="dash-brand-name">{session.tenantSlug}</span>
        </div>
        <nav className="dash-nav">
          {navItems.map((item) => {
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
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="dash-main">
        <header className="dash-topbar">
          <div className="dash-topbar-context">
            <span className="dash-topbar-tenant">{session.tenantSlug}</span>
          </div>
          <div className="dash-topbar-user">
            <LanguageSwitcher />
            <span className="dash-user-name">{session.displayName ?? t("signedIn")}</span>
            <button
              type="button"
              className="dash-signout"
              onClick={() => void handleSignOut()}
            >
              {t("signOut")}
            </button>
          </div>
        </header>
        <div className="dash-content">{children}</div>
      </div>
    </div>
  );
}
