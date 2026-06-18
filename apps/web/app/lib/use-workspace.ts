"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "./api";
import { clearSession, getSession, setSession, type Session } from "./session";

type MeResponse = {
  userId: string;
  tenantId: string;
  displayName?: string;
  roles: string[];
  permissions: string[];
};

export function useWorkspace() {
  const router = useRouter();
  const [session, setSessionState] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current = getSession();
    if (!current) {
      setSessionState(null);
      setReady(true);
      return;
    }

    if (!current.tenantId || current.isPlatform) {
      setSessionState(current);
      setReady(true);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const me = await apiFetch<MeResponse>(`/tenants/${current!.tenantId}/auth/me`);
        if (cancelled) {
          return;
        }
        const merged: Session = {
          ...current!,
          tenantId: me.tenantId,
          displayName: me.displayName ?? current!.displayName,
          roles: me.roles,
          permissions: me.permissions
        };
        setSession(merged);
        setSessionState(merged);
      } catch (error) {
        if (!cancelled) {
          if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
            clearSession();
            setSessionState(null);
            router.replace("/");
            return;
          }
          setSessionState(current);
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return { session, ready };
}
