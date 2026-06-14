export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  actorUserId: string;
  roles: string[];
  permissions: string[];
}

export interface TenantResolutionInput {
  host?: string;
  tenantSlug?: string;
  schoolCode?: string;
}
