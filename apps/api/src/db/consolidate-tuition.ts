/**
 * One-time, idempotent data migration: collapse per-grade tuition components
 * ("KG Tuition", "Grade 1 Tuition", …) into a single reusable "Tuition"
 * component per tenant, preserving each grade's amount.
 *
 * For every tenant it:
 *  - picks a canonical tuition fee_item (the one named "Tuition" if present,
 *    otherwise the oldest) and renames it "Tuition";
 *  - repoints all enrollment_fee_plans of the other tuition items to it;
 *  - repoints any discount_rules.criteria.appliesTo.feeItemIds referencing the
 *    old items to the canonical one;
 *  - archives the now-redundant tuition items.
 *
 * Historical invoice_items are left untouched. Running again is a no-op.
 *
 *   npm run db:consolidate-tuition  (from apps/api)
 */
import { config } from "dotenv";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { discountRules, enrollmentFeePlans, feeItems, tenants } from "./schema.js";

config();
config({ path: "../../.env" });

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgres://sms:sms@localhost:5432/sms"
  });
  const db = drizzle(pool);

  try {
    const tenantRows = await db.select({ id: tenants.id, name: tenants.name }).from(tenants);
    let tenantsChanged = 0;

    for (const tenant of tenantRows) {
      const tuition = await db
        .select({ id: feeItems.id, name: feeItems.name })
        .from(feeItems)
        .where(
          and(
            eq(feeItems.tenantId, tenant.id),
            eq(feeItems.feeType, "tuition"),
            eq(feeItems.status, "active")
          )
        )
        .orderBy(feeItems.id);

      if (tuition.length <= 1) {
        // Already a single component — make sure it's named "Tuition".
        if (tuition.length === 1 && tuition[0]!.name !== "Tuition") {
          await db
            .update(feeItems)
            .set({ name: "Tuition", updatedAt: new Date() })
            .where(eq(feeItems.id, tuition[0]!.id));
        }
        continue;
      }

      const canonical = tuition.find((t) => t.name === "Tuition") ?? tuition[0]!;
      const others = tuition.filter((t) => t.id !== canonical.id);
      const otherIds = others.map((t) => t.id);

      // 1. Repoint plans of the redundant tuition items to the canonical one.
      await db
        .update(enrollmentFeePlans)
        .set({ feeItemId: canonical.id, updatedAt: new Date() })
        .where(
          and(
            eq(enrollmentFeePlans.tenantId, tenant.id),
            inArray(enrollmentFeePlans.feeItemId, otherIds)
          )
        );

      // 2. Repoint discount criteria that referenced the old tuition items.
      const otherIdSet = new Set(otherIds);
      const ruleRows = await db
        .select({ id: discountRules.id, criteria: discountRules.criteria })
        .from(discountRules)
        .where(eq(discountRules.tenantId, tenant.id));
      for (const rule of ruleRows) {
        const criteria = (rule.criteria ?? {}) as {
          appliesTo?: { feeItemIds?: string[] };
        };
        const ids = criteria.appliesTo?.feeItemIds;
        if (!Array.isArray(ids) || !ids.some((id) => otherIdSet.has(id))) continue;
        const next = Array.from(
          new Set(ids.map((id) => (otherIdSet.has(id) ? canonical.id : id)))
        );
        await db
          .update(discountRules)
          .set({
            criteria: { ...criteria, appliesTo: { ...criteria.appliesTo, feeItemIds: next } },
            updatedAt: new Date()
          })
          .where(eq(discountRules.id, rule.id));
      }

      // 3. Name the canonical "Tuition" and archive the redundant items.
      if (canonical.name !== "Tuition") {
        await db
          .update(feeItems)
          .set({ name: "Tuition", updatedAt: new Date() })
          .where(eq(feeItems.id, canonical.id));
      }
      await db
        .update(feeItems)
        .set({ status: "archived", updatedAt: new Date() })
        .where(and(eq(feeItems.tenantId, tenant.id), inArray(feeItems.id, otherIds)));

      tenantsChanged += 1;
      console.log(
        `[${tenant.name}] consolidated ${others.length} tuition component(s) into "${canonical.id}"`
      );
    }

    console.log(`Done. Tenants changed: ${tenantsChanged}/${tenantRows.length}.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
