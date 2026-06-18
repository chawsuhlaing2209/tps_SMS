"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { getSession, setSession, type Session } from "./session";

type MeResponse = {
  userId: string;
  tenantId: string;
  displayName?: string;
  roles: string[];
  permissions: string[];
};

export function useWorkspace() {
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
          displayName: me.displayName ?? current!.displayName,
          roles: me.roles,
          permissions: me.permissions
        };
        setSession(merged);
        setSessionState(merged);
      } catch {
        if (!cancelled) {
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
  }, []);

  return { session, ready };
}
