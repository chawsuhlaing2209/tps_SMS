"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { clearSession } from "../lib/session";
import { TenantDataBootstrap } from "../lib/tenant-data-bootstrap";
import { DashboardRoutePrefetch } from "../lib/dashboard-route-prefetch";
import { useWorkspace } from "../lib/use-workspace";
import { DashboardPageChrome } from "./dashboard-page-chrome";
import { DashboardPageTitle } from "./dashboard-page-title";
import { DashboardSidebar, DashboardSidebarDrawer } from "./dashboard-sidebar";
import { PageHeaderProvider } from "./page-header-context";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const t = useTranslations("nav");
  const { session, ready } = useWorkspace();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
      <PageHeaderProvider>
        <div className="dash-loading">
          <span>{t("loadingWorkspace")}</span>
        </div>
      </PageHeaderProvider>
    );
  }

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
      <TenantDataBootstrap permissions={session.permissions ?? []} />
      <DashboardRoutePrefetch permissions={session.permissions ?? []} />
      <div className="dash">
        <DashboardSidebar
          displayName={session.displayName ?? t("signedIn")}
          roles={session.roles}
          tenantSlug={session.tenantSlug}
          permissions={session.permissions ?? []}
          onSignOut={() => void handleSignOut()}
        />
        <DashboardSidebarDrawer
          open={mobileNavOpen}
          onOpenChange={setMobileNavOpen}
          displayName={session.displayName ?? t("signedIn")}
          roles={session.roles}
          tenantSlug={session.tenantSlug}
          permissions={session.permissions ?? []}
          onSignOut={() => void handleSignOut()}
        />

        <div className="dash-main">
          <div className="dash-content">
            <DashboardPageChrome onMenuClick={() => setMobileNavOpen(true)} />
            <div className="dash-content-body">
              <DashboardPageTitle />
              {children}
            </div>
          </div>
        </div>
      </div>
    </PageHeaderProvider>
  );
}
