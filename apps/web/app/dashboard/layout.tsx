"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LanguageSwitcher } from "../lib/language-switcher";
import { clearSession, getSession, type Session } from "../lib/session";

const NAV_ITEMS = [
  { href: "/dashboard", key: "overview" },
  { href: "/dashboard/academics", key: "academics" },
  { href: "/dashboard/people", key: "people" },
  { href: "/dashboard/audit", key: "audit" }
] as const;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [session, setSessionState] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current = getSession();
    if (!current) {
      router.replace("/");
      return;
    }
    setSessionState(current);
    setReady(true);
  }, [router]);

  if (!ready || !session) {
    return (
      <div className="dash-loading">
        <span>{t("loadingWorkspace")}</span>
      </div>
    );
  }

  async function handleSignOut() {
    try {
      if (session) {
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
          {NAV_ITEMS.map((item) => {
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
