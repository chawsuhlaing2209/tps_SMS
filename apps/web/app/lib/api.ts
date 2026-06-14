"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from "@tanstack/react-query";
import { useCallback } from "react";
import { getSession, isPlatformSession } from "./session";

// All requests go to the Next.js origin under /api and are proxied to the API
// (see next.config.ts), so there is never a cross-origin/CORS request.
const API_PREFIX = "/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  // Authorization is enforced server-side from the httpOnly session cookie. The
  // x-user-id header is only used to attribute audit events to the acting user;
  // it is not trusted for access control.
  const session = getSession();
  if (session?.userId) {
    headers.set("x-user-id", session.userId);
  }

  // Authentication rides on the httpOnly session cookie; include credentials so
  // the browser sends it through the same-origin /api proxy.
  const response = await fetch(`${API_PREFIX}${path}`, {
    ...init,
    headers,
    credentials: "include"
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(body?.message ?? `Request failed (${response.status})`, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/**
 * Stable, tenant-scoped query key. Keeping tenant id at the front makes it easy
 * to invalidate everything for the current tenant in one call.
 */
export function tenantQueryKey(tenantId: string, path: string): unknown[] {
  return ["tenant", tenantId, ...path.split("/").filter(Boolean)];
}

/**
 * Tenant-scoped read backed by TanStack Query. Pass a builder that receives the
 * tenant id and returns the request path, or null to skip the request.
 */
export function useApiQuery<T>(
  buildPath: (tenantId: string) => string | null
): UseQueryResult<T> & { tenantId: string | null } {
  const session = getSession();
  const tenantId = session?.tenantId ?? null;
  const path = tenantId ? buildPath(tenantId) : null;

  const query = useQuery<T>({
    queryKey: tenantId && path ? tenantQueryKey(tenantId, path) : ["tenant", "anonymous"],
    queryFn: () => apiFetch<T>(path as string),
    enabled: Boolean(tenantId && path)
  });

  return { ...query, tenantId };
}

/**
 * Tenant-scoped write backed by TanStack Query. After a successful mutation it
 * invalidates the provided query paths so dependent reads refetch.
 */
export function useApiMutation<TVariables, TResult = unknown>(
  buildRequest: (
    variables: TVariables,
    tenantId: string
  ) => { path: string; init?: RequestInit },
  options: { invalidatePaths?: (variables: TVariables, tenantId: string) => string[] } = {}
): UseMutationResult<TResult, Error, TVariables> {
  const queryClient = useQueryClient();

  return useMutation<TResult, Error, TVariables>({
    mutationFn: async (variables: TVariables) => {
      const session = getSession();
      if (!session?.tenantId) {
        throw new ApiError("Not signed in.", 401);
      }
      const { path, init } = buildRequest(variables, session.tenantId);
      return apiFetch<TResult>(path, init);
    },
    onSuccess: (_result, variables) => {
      const session = getSession();
      if (!session?.tenantId) {
        return;
      }
      const paths = options.invalidatePaths?.(variables, session.tenantId) ?? [];
      for (const path of paths) {
        void queryClient.invalidateQueries({
          queryKey: tenantQueryKey(session.tenantId, path)
        });
      }
    }
  });
}

const PLATFORM_QUERY_KEY = ["platform"] as const;

/** Platform-scoped read for the super-admin console. */
export function usePlatformQuery<T>(path: string): UseQueryResult<T> {
  const session = getSession();
  const enabled = isPlatformSession(session);

  return useQuery<T>({
    queryKey: [...PLATFORM_QUERY_KEY, path],
    queryFn: () => apiFetch<T>(path),
    enabled
  });
}

/** Platform-scoped write for the super-admin console. */
export function usePlatformMutation<TVariables, TResult = unknown>(
  buildRequest: (variables: TVariables) => { path: string; init?: RequestInit },
  options: { invalidatePaths?: string[] } = {}
): UseMutationResult<TResult, Error, TVariables> {
  const queryClient = useQueryClient();

  return useMutation<TResult, Error, TVariables>({
    mutationFn: async (variables: TVariables) => {
      if (!isPlatformSession(getSession())) {
        throw new ApiError("Not signed in.", 401);
      }
      const { path, init } = buildRequest(variables);
      return apiFetch<TResult>(path, init);
    },
    onSuccess: () => {
      for (const path of options.invalidatePaths ?? []) {
        void queryClient.invalidateQueries({ queryKey: [...PLATFORM_QUERY_KEY, path] });
      }
    }
  });
}

type ApiState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
};

/**
 * Backwards-compatible adapter over {@link useApiQuery} that preserves the
 * original `{ data, error, loading, reload }` shape used by existing pages.
 */
export function useApiData<T>(buildPath: (tenantId: string) => string | null): ApiState<T> {
  const query = useApiQuery<T>(buildPath);
  const reload = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    data: query.data ?? null,
    error: query.isError ? errorMessage(query.error) : query.tenantId ? null : "Not signed in.",
    loading: query.isLoading && query.fetchStatus !== "idle",
    reload
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
