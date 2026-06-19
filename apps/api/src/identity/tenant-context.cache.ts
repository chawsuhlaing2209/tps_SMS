import { Injectable } from "@nestjs/common";
import type { TenantContext } from "../tenancy/tenant-context.js";

type CacheEntry = {
  value: TenantContext;
  expiresAt: number;
};

const DEFAULT_TTL_MS = 60_000;

@Injectable()
export class TenantContextCache {
  private readonly ttlMs = Number(process.env.TENANT_CONTEXT_CACHE_TTL_MS ?? DEFAULT_TTL_MS);
  private readonly entries = new Map<string, CacheEntry>();

  get(tenantId: string, actorUserId: string): TenantContext | undefined {
    const key = this.key(tenantId, actorUserId);
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(tenantId: string, actorUserId: string, value: TenantContext): void {
    this.entries.set(this.key(tenantId, actorUserId), {
      value,
      expiresAt: Date.now() + this.ttlMs
    });
  }

  invalidateUser(tenantId: string, actorUserId: string): void {
    this.entries.delete(this.key(tenantId, actorUserId));
  }

  invalidateTenant(tenantId: string): void {
    const prefix = `${tenantId}:`;
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
      }
    }
  }

  private key(tenantId: string, actorUserId: string): string {
    return `${tenantId}:${actorUserId}`;
  }
}
