import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import { tenantSettings } from "../db/schema.js";
import { purgeArchivedForTenant } from "./purge-archived-runner.js";

@Injectable()
export class ArchiveService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Run the retention auto-purge for one tenant now (manual trigger). */
  async purgeNow(tenantId: string) {
    const [settings] = await this.db
      .select({ days: tenantSettings.archiveRetentionDays })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId));
    const days = settings?.days ?? 0;
    return purgeArchivedForTenant(this.db, tenantId, days);
  }
}
