"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult
} from "@tanstack/react-query";
import { useCallback } from "react";
import { getSession, isPlatformSession } from "./session";
import { toastError, toastSuccess } from "./toast";

// All requests go to the Next.js origin under /api and are proxied to the API
// (see next.config.ts), so there is never a cross-origin/CORS request.
const API_PREFIX = "/api";

/** Master data (years, grades, subjects) — safe to cache briefly between navigations. */
export const REFERENCE_DATA_STALE_MS = 60_000;

/** Finance, roster, and operational lists — always refetch on mount. */
export const LIVE_DATA_STALE_MS = 0;

export type ApiQueryOptions = {
  staleTime?: number;
  gcTime?: number;
};

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
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const rawMessage = body?.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join(" ")
      : rawMessage ?? `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/**
 * Stable, tenant-scoped query key. Pathname segments are separate from query
 * params so prefix invalidation (e.g. all `/finance/invoices` reads) works even
 * when list queries append `?limit=` filters.
 */
export function tenantQueryKey(tenantId: string, path: string): unknown[] {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const question = normalized.indexOf("?");
  const pathname = question >= 0 ? normalized.slice(0, question) : normalized;
  const search = question >= 0 ? normalized.slice(question + 1) : "";
  const segments = pathname.split("/").filter(Boolean);
  const key: unknown[] = ["tenant", tenantId, ...segments];

  if (search) {
    const params = new URLSearchParams(search);
    const stable: Record<string, string> = {};
    for (const [name, value] of [...params.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      stable[name] = value;
    }
    key.push(stable);
  }

  return key;
}

/** Invalidate every cached read whose path starts with one of the given prefixes. */
export async function invalidateTenantPaths(
  queryClient: QueryClient,
  tenantId: string,
  paths: string[]
) {
  await Promise.all(
    paths.map((path) => {
      const pathname = path.split("?")[0] ?? path;
      return queryClient.invalidateQueries({
        queryKey: tenantQueryKey(tenantId, pathname),
        refetchType: "active"
      });
    })
  );
}

/**
 * Tenant-scoped read backed by TanStack Query. Pass a builder that receives the
 * tenant id and returns the request path, or null to skip the request.
 */
export function useApiQuery<T>(
  buildPath: (tenantId: string) => string | null,
  options: ApiQueryOptions = {}
): UseQueryResult<T> & { tenantId: string | null } {
  const session = getSession();
  const tenantId = session?.tenantId ?? null;
  const path = tenantId ? buildPath(tenantId) : null;

  const query = useQuery<T>({
    queryKey: tenantId && path ? tenantQueryKey(tenantId, path) : ["tenant", "anonymous"],
    queryFn: () => apiFetch<T>(path as string),
    enabled: Boolean(tenantId && path),
    staleTime: options.staleTime,
    gcTime: options.gcTime
  });

  return { ...query, tenantId };
}

/** Cached reads for academic master data and other slow-changing reference lists. */
export function useReferenceApiQuery<T>(
  buildPath: (tenantId: string) => string | null
): UseQueryResult<T> & { tenantId: string | null } {
  return useApiQuery<T>(buildPath, { staleTime: REFERENCE_DATA_STALE_MS });
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
  options: {
    invalidatePaths?: (variables: TVariables, tenantId: string) => string[];
    successMessage?: string;
    showSuccessToast?: boolean;
    showErrorToast?: boolean;
  } = {}
): UseMutationResult<TResult, Error, TVariables> {
  const queryClient = useQueryClient();
  const {
    successMessage = "Saved successfully.",
    showSuccessToast = true,
    showErrorToast = true
  } = options;

  return useMutation<TResult, Error, TVariables>({
    mutationFn: async (variables: TVariables) => {
      const session = getSession();
      if (!session?.tenantId) {
        throw new ApiError("Not signed in.", 401);
      }
      const { path, init } = buildRequest(variables, session.tenantId);
      const result = await apiFetch<TResult>(path, init);
      const invalidate = options.invalidatePaths?.(variables, session.tenantId) ?? [];
      if (invalidate.length) {
        await invalidateTenantPaths(queryClient, session.tenantId, invalidate);
      }
      return result;
    },
    onSuccess: () => {
      if (showSuccessToast) {
        toastSuccess(successMessage);
      }
    },
    onError: (error) => {
      if (showErrorToast) {
        toastError(error);
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
  options: {
    invalidatePaths?: string[];
    successMessage?: string;
    showSuccessToast?: boolean;
    showErrorToast?: boolean;
  } = {}
): UseMutationResult<TResult, Error, TVariables> {
  const queryClient = useQueryClient();
  const {
    successMessage = "Saved successfully.",
    showSuccessToast = true,
    showErrorToast = true
  } = options;

  return useMutation<TResult, Error, TVariables>({
    mutationFn: async (variables: TVariables) => {
      if (!isPlatformSession(getSession())) {
        throw new ApiError("Not signed in.", 401);
      }
      const { path, init } = buildRequest(variables);
      return apiFetch<TResult>(path, init);
    },
    onSuccess: () => {
      if (showSuccessToast) {
        toastSuccess(successMessage);
      }
      for (const path of options.invalidatePaths ?? []) {
        void queryClient.invalidateQueries({ queryKey: [...PLATFORM_QUERY_KEY, path] });
      }
    },
    onError: (error) => {
      if (showErrorToast) {
        toastError(error);
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
