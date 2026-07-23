import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";
import * as schema from "./schema.js";
import { tenantDbContextStorage } from "./tenant-db-context.js";

export const DB = Symbol("DB");

export type Database = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Stamp the request's tenant context into the session settings the RLS
 * policies read (`app.tenant_id`, `app.bypass_rls`). Runs on EVERY checkout
 * and always sets both values, so state can never leak between requests that
 * share a pooled connection. NOTE: safe with the app-level pool only — if a
 * transaction-pooling proxy (pgBouncer) is ever added in front of Postgres,
 * this must move inside a per-request transaction with set_config(..., true).
 */
async function applyTenantContext(client: PoolClient): Promise<void> {
  const ctx = tenantDbContextStorage.getStore();
  await client.query(
    "SELECT set_config('app.tenant_id', $1, false), set_config('app.bypass_rls', $2, false)",
    [ctx?.tenantId ?? "", ctx?.bypassRls ? "on" : ""]
  );
}

type ConnectCallback = (
  err: Error | undefined,
  client: PoolClient | undefined,
  done: (release?: unknown) => void
) => void;

/** pg Pool whose checkouts carry the current request's tenant RLS context. */
class TenantContextPool extends Pool {
  override connect(...args: unknown[]): Promise<PoolClient> {
    const callback = args[0] as ConnectCallback | undefined;

    if (typeof callback !== "function") {
      return super.connect().then(async (client) => {
        try {
          await applyTenantContext(client);
        } catch (error) {
          client.release(error as Error);
          throw error;
        }
        return client;
      });
    }

    super.connect((err, client, done) => {
      if (err || !client) {
        callback(err ?? undefined, client, done);
        return;
      }
      applyTenantContext(client).then(
        () => callback(undefined, client, done),
        (contextError: Error) => {
          done(contextError);
          callback(contextError, undefined, done);
        }
      );
    });
    return undefined as unknown as Promise<PoolClient>;
  }
}

@Module({
  providers: [
    {
      provide: DB,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // APP_DATABASE_URL is the least-privilege role subject to RLS
        // (sms_app). DATABASE_URL (owner) remains for migrations/seeds and as
        // a dev fallback when the app URL is not configured.
        const connectionString =
          configService.get<string>("APP_DATABASE_URL") ??
          configService.getOrThrow<string>("DATABASE_URL");
        const pool = new TenantContextPool({
          connectionString,
          max: Number(process.env.DATABASE_POOL_MAX ?? 20),
          idleTimeoutMillis: Number(process.env.DATABASE_POOL_IDLE_MS ?? 30_000),
          connectionTimeoutMillis: Number(process.env.DATABASE_POOL_CONNECT_MS ?? 5_000)
        });

        return drizzle(pool, { schema });
      }
    }
  ],
  exports: [DB]
})
export class DbModule {}
