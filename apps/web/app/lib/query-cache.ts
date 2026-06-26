import type { QueryClient } from "@tanstack/react-query";
import {
  apiFetch,
  LIST_DATA_STALE_MS,
  REFERENCE_DATA_STALE_MS,
  tenantQueryKey
} from "./api";
import { collectVisibleNavHrefs } from "./visible-nav-hrefs";

const LIVE_ROUTE_PREFIXES = [
  "/dashboard/finance/payments",
  "/dashboard/finance/billing",
  "/dashboard/audit"
] as const;

const PREFETCH_BATCH_SIZE = 5;
const PREFETCH_BATCH_GAP_MS = 12;

type YearContext = { id: string } | null | undefined;

function tenantBase(tenantId: string) {
  return `/tenants/${tenantId}`;
}

/** Paths warmed on dashboard entry — academic context required by most modules. */
export function tenantBootstrapPaths(tenantId: string): string[] {
  const base = tenantBase(tenantId);
  return [
    `${base}/dashboard/academic-year`,
    `${base}/academics/setup/academic-years`,
    `${base}/academics/terms`
  ];
}

function shouldPrefetchApisForRoute(href: string) {
  return !LIVE_ROUTE_PREFIXES.some((prefix) => href === prefix || href.startsWith(`${prefix}/`));
}

function staleTimeForPath(path: string) {
  if (path.includes("/finance/") || path.includes("/audit-logs") || path.includes("/attendance")) {
    return LIST_DATA_STALE_MS;
  }
  return REFERENCE_DATA_STALE_MS;
}

/**
 * Primary API reads for a dashboard route. Kept in one registry so bootstrap,
 * hover prefetch, and future server warmers share the same map.
 */
export function prefetchPathsForDashboardRoute(
  tenantId: string,
  pathname: string,
  academicYear?: YearContext
): string[] {
  const base = tenantBase(tenantId);
  const yearId = academicYear?.id;
  const paths: string[] = [];

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard?")) {
    paths.push(`${base}/dashboard/home`);
  }

  if (pathname.startsWith("/dashboard/academic-setup/years")) {
    paths.push(`${base}/academics/setup/academic-years`);
  }

  if (pathname.startsWith("/dashboard/academic-setup/grades-classrooms") && yearId) {
    paths.push(
      `${base}/academics/setup/academic-years/${yearId}/grades`,
      `${base}/academics/subjects`,
      `${base}/facility-rooms`
    );
  }

  if (pathname.startsWith("/dashboard/academic-setup/subjects") && yearId) {
    paths.push(
      `${base}/academics/setup/academic-years/${yearId}/subjects`,
      `${base}/academics/subjects`
    );
  }

  if (pathname.startsWith("/dashboard/academic-setup/terms") && yearId) {
    paths.push(`${base}/academics/terms`);
  }

  if (pathname.startsWith("/dashboard/structure") && yearId) {
    paths.push(
      `${base}/academics/setup/academic-years/${yearId}/grades`,
      `${base}/academics/setup/academic-years/${yearId}/subjects`
    );
  }

  if (pathname.startsWith("/dashboard/teachers")) {
    paths.push(
      `${base}/hr/staff/overview?employmentRole=teacher&limit=50&offset=0`,
      `${base}/academics/grades`
    );
  }

  if (pathname.startsWith("/dashboard/people") || pathname.startsWith("/dashboard/students")) {
    paths.push(`${base}/students?limit=50&offset=0`);
  }

  if (pathname.startsWith("/dashboard/admissions")) {
    paths.push(`${base}/admissions/dashboard`, `${base}/admissions/enquiries`);
  }

  if (pathname.startsWith("/dashboard/enrollments") && yearId) {
    paths.push(`${base}/enrollments?academicYearId=${yearId}`);
  }

  if (pathname.startsWith("/dashboard/calendar") && yearId) {
    paths.push(`${base}/calendar?academicYearId=${yearId}`);
  }

  if (pathname.startsWith("/dashboard/timetable") && yearId) {
    paths.push(`${base}/timetable?academicYearId=${yearId}`);
  }

  if (pathname.startsWith("/dashboard/exams")) {
    paths.push(`${base}/exam-cycles`);
  }

  if (pathname.startsWith("/dashboard/finance/overview") && yearId) {
    const month = new Date().toISOString().slice(0, 7);
    paths.push(`${base}/finance/reports/overview?academicYearId=${yearId}&month=${month}`);
    paths.push(`${base}/academics/academic-years`);
  }

  if (pathname.startsWith("/dashboard/finance/invoices") && yearId) {
    paths.push(
      `${base}/finance/invoices?limit=50&offset=0&academicYearId=${yearId}&sortBy=createdAt&sortDir=desc`
    );
  }

  if (pathname.startsWith("/dashboard/finance/fee-structures") && yearId) {
    paths.push(`${base}/finance/fee-structures?academicYearId=${yearId}`);
  }

  if (pathname.startsWith("/dashboard/finance/payment-plans")) {
    paths.push(`${base}/finance/payment-plans`);
  }

  if (pathname.startsWith("/dashboard/finance/discounts")) {
    paths.push(`${base}/finance/discounts/rules`);
  }

  if (pathname.startsWith("/dashboard/salary")) {
    paths.push(
      `${base}/pay-components`,
      `${base}/salary/components`,
      `${base}/salary/records?limit=50&offset=0`
    );
  }

  if (pathname.startsWith("/dashboard/communication")) {
    paths.push(`${base}/email-templates`);
  }

  if (pathname.startsWith("/dashboard/team")) {
    paths.push(`${base}/hr/staff/overview?limit=50&offset=0`);
  }

  if (pathname.startsWith("/dashboard/departments")) {
    paths.push(`${base}/departments`);
  }

  if (pathname.startsWith("/dashboard/facilities")) {
    paths.push(`${base}/facility-rooms`);
  }

  if (pathname.startsWith("/dashboard/settings/school-schedule")) {
    paths.push(`${base}/settings/school-schedule`);
  }

  if (pathname.startsWith("/dashboard/settings/user-roles")) {
    paths.push(`${base}/identity/roles`);
  }

  return [...new Set(paths)];
}

export async function prefetchTenantPaths(
  queryClient: QueryClient,
  tenantId: string,
  paths: string[],
  staleTime?: number
) {
  await Promise.all(
    paths.map((path) =>
      queryClient.prefetchQuery({
        queryKey: tenantQueryKey(tenantId, path),
        queryFn: () => apiFetch(path),
        staleTime: staleTime ?? staleTimeForPath(path)
      })
    )
  );
}

export function readCachedAcademicYear(
  queryClient: QueryClient,
  tenantId: string
): YearContext {
  return queryClient.getQueryData(
    tenantQueryKey(tenantId, `${tenantBase(tenantId)}/dashboard/academic-year`)
  ) as YearContext;
}

async function ensureAcademicYear(queryClient: QueryClient, tenantId: string) {
  const path = `${tenantBase(tenantId)}/dashboard/academic-year`;
  return queryClient.fetchQuery({
    queryKey: tenantQueryKey(tenantId, path),
    queryFn: () => apiFetch(path),
    staleTime: REFERENCE_DATA_STALE_MS
  }) as Promise<YearContext>;
}

function orderedPrefetchHrefs(
  permissions: readonly string[] | undefined,
  activePathname: string
) {
  const hrefs = collectVisibleNavHrefs(permissions);
  if (!activePathname || activePathname === "/dashboard") {
    return ["/dashboard", ...hrefs.filter((href) => href !== "/dashboard")];
  }
  return [activePathname, ...hrefs.filter((href) => href !== activePathname)];
}

function collectWarmPaths(
  tenantId: string,
  permissions: readonly string[] | undefined,
  activePathname: string,
  academicYear: YearContext
) {
  const paths: string[] = [...tenantBootstrapPaths(tenantId)];
  for (const href of orderedPrefetchHrefs(permissions, activePathname)) {
    if (!shouldPrefetchApisForRoute(href)) {
      continue;
    }
    paths.push(...prefetchPathsForDashboardRoute(tenantId, href, academicYear));
  }
  return [...new Set(paths)];
}

/**
 * Warms API cache for first navigation: academic year first (removes waterfalls),
 * then every module the user can access — active route prioritized.
 */
export async function warmTenantDashboardCache(
  queryClient: QueryClient,
  tenantId: string,
  permissions: readonly string[] | undefined,
  activePathname: string
) {
  const academicYear = await ensureAcademicYear(queryClient, tenantId);

  const activePaths = [
    ...tenantBootstrapPaths(tenantId),
    ...prefetchPathsForDashboardRoute(tenantId, activePathname, academicYear)
  ];
  await prefetchTenantPaths(queryClient, tenantId, [...new Set(activePaths)]);

  const allPaths = collectWarmPaths(tenantId, permissions, activePathname, academicYear);
  const activeSet = new Set(activePaths);
  const remaining = allPaths.filter((path) => !activeSet.has(path));

  for (let index = 0; index < remaining.length; index += PREFETCH_BATCH_SIZE) {
    await prefetchTenantPaths(
      queryClient,
      tenantId,
      remaining.slice(index, index + PREFETCH_BATCH_SIZE)
    );
    if (index + PREFETCH_BATCH_SIZE < remaining.length) {
      await new Promise((resolve) => setTimeout(resolve, PREFETCH_BATCH_GAP_MS));
    }
  }
}
