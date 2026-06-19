"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LanguageSwitcher } from "../lib/language-switcher";
import { clearSession, getSession, isPlatformSession, type Session } from "../lib/session";

export default function PlatformLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("platformNav");
  const [session, setSessionState] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  const isLoginPage = pathname === "/platform/login";

  useEffect(() => {
    const current = getSession();
    if (isLoginPage) {
      if (current && isPlatformSession(current)) {
        router.replace("/platform/tenants");
        return;
      }
      setReady(true);
      return;
    }
    if (!current || !isPlatformSession(current)) {
      router.replace("/platform/login");
      return;
    }
    setSessionState(current);
    setReady(true);
  }, [router, isLoginPage]);

  if (!ready) {
    return (
      <div className="dash-loading">
        <span>{t("loading")}</span>
      </div>
    );
  }

  if (isLoginPage) {
    return children;
  }

  if (!session) {
    return null;
  }

  async function handleSignOut() {
    try {
      await fetch("/api/platform/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // Clearing local state below still signs the user out of the browser.
    } finally {
      clearSession();
      router.replace("/platform/login");
    }
  }

  return (
    <div className="dash">
      <aside className="dash-sidebar">
        <div className="dash-brand">
          <span className="dash-brand-mark">SMS</span>
          <span className="pds-type-title-l-extrabold dash-brand-name">{t("console")}</span>
        </div>
        <nav className="dash-nav">
          <Link
            href="/platform/tenants"
            className={
              pathname.startsWith("/platform/tenants")
                ? "dash-nav-link dash-nav-link--active"
                : "dash-nav-link"
            }
          >
            {t("tenants")}
          </Link>
        </nav>
      </aside>

      <div className="dash-main">
        <header className="dash-topbar">
          <div className="dash-topbar-context">
            <span className="dash-topbar-tenant">{t("platformAdmin")}</span>
          </div>
          <div className="dash-topbar-user">
            <LanguageSwitcher />
            <span className="dash-user-name">{session.displayName ?? t("signedIn")}</span>
            <button
              type="button"
              className="pds-type-body-m-medium dash-signout"
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
