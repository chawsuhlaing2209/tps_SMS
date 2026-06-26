"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { apiFetch, ApiError, tenantQueryKey } from "./api";
import { clearSession, getSession, setSession, type Session } from "./session";

const WORKSPACE_STALE_MS = 5 * 60_000;

type MeResponse = {
  userId: string;
  tenantId: string;
  displayName?: string;
  roles: string[];
  permissions: string[];
};

export function useWorkspace() {
  const router = useRouter();
  const localSession = getSession();
  const tenantId = localSession?.tenantId ?? null;
  const skipRemote =
    !localSession || !tenantId || localSession.isPlatform || localSession.tenantId === null;

  const meQuery = useQuery({
    queryKey:
      tenantId && !skipRemote
        ? tenantQueryKey(tenantId, `/tenants/${tenantId}/auth/me`)
        : ["workspace", "anonymous"],
    queryFn: () => apiFetch<MeResponse>(`/tenants/${tenantId}/auth/me`),
    enabled: !skipRemote,
    staleTime: WORKSPACE_STALE_MS,
    retry: false
  });

  useEffect(() => {
    if (skipRemote) {
      return;
    }
    if (!meQuery.isError) {
      return;
    }
    const error = meQuery.error;
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
      clearSession();
      router.replace("/");
    }
  }, [meQuery.error, meQuery.isError, router, skipRemote]);

  const session = useMemo<Session | null>(() => {
    if (!localSession) {
      return null;
    }
    if (skipRemote) {
      return localSession;
    }
    if (meQuery.data) {
      return {
        ...localSession,
        userId: meQuery.data.userId,
        tenantId: meQuery.data.tenantId,
        displayName: meQuery.data.displayName ?? localSession.displayName,
        roles: meQuery.data.roles,
        permissions: meQuery.data.permissions
      };
    }
    return localSession;
  }, [localSession, meQuery.data, skipRemote]);

  useEffect(() => {
    if (!session || skipRemote || !meQuery.data) {
      return;
    }
    setSession(session);
  }, [session, meQuery.data, skipRemote]);

  const ready = skipRemote ? true : meQuery.isFetched || meQuery.isError;

  return { session, ready };
}
