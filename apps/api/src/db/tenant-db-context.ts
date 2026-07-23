import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request-scoped tenant context for the Postgres RLS backstop (DEPLOYMENT.md
 * invariant I4). The DB pool reads this store at every connection checkout and
 * stamps it into transaction-safe session settings (`app.tenant_id`,
 * `app.bypass_rls`) that the row-level-security policies evaluate.
 *
 * The store is created once per HTTP request by the middleware in `main.ts`
 * (pre-filled from a UUID `/tenants/:tenantId/…` path when present) and then
 * narrowed/widened by trusted code only:
 *  - `AuthService.resolveTenantId` stamps the tenant after resolving a slug,
 *  - `PlatformAdminGuard` enables the bypass after the actor is verified.
 */
export type TenantDbContext = {
  tenantId?: string;
  bypassRls?: boolean;
};

export const tenantDbContextStorage = new AsyncLocalStorage<TenantDbContext>();

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Path prefix of every tenant-scoped route: `/tenants/<id-or-slug>/…`. */
const TENANT_PATH = /^\/tenants\/([^/]+)\//;

/** Extract the tenant UUID from a request path, if the segment is a UUID. */
export function tenantIdFromPath(path: string): string | undefined {
  const segment = TENANT_PATH.exec(path)?.[1];
  return segment && UUID_PATTERN.test(segment) ? segment : undefined;
}

/**
 * Stamp the resolved tenant id into the current request's DB context. Called
 * by trusted resolution points (slug → UUID lookups) so slug-addressed routes
 * get the same RLS scoping as UUID-addressed ones. No-op outside a request.
 */
export function setTenantDbContext(tenantId: string): void {
  const store = tenantDbContextStorage.getStore();
  if (store) {
    store.tenantId = tenantId;
  }
}

/**
 * Allow this request to read across tenants (platform administration).
 * Only call after the actor has been verified as a platform admin.
 */
export function enableRlsBypass(): void {
  const store = tenantDbContextStorage.getStore();
  if (store) {
    store.bypassRls = true;
  }
}
