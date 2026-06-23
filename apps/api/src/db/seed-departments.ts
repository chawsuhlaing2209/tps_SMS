import { and, eq, isNotNull } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/node-postgres";
import { departments, staff } from "./schema.js";

type Db = ReturnType<typeof drizzle>;

const DEFAULT_DEPARTMENTS = [
  { name: "Leadership", description: "School leadership and executive team." },
  { name: "Administration", description: "Front office and school operations." },
  { name: "Finance", description: "Accounts, billing, and fee collection." },
  { name: "Human Resources", description: "Staff records, payroll, and hiring." },
  { name: "Teaching", description: "Classroom teachers and academic staff." }
] as const;

export async function seedDepartments(db: Db, tenantId: string) {
  const departmentIds = new Map<string, string>();

  for (const row of DEFAULT_DEPARTMENTS) {
    const [existing] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.tenantId, tenantId), eq(departments.name, row.name)));

    if (existing) {
      await db
        .update(departments)
        .set({ description: row.description, status: "active" })
        .where(eq(departments.id, existing.id));
      departmentIds.set(row.name, existing.id);
      continue;
    }

    const [created] = await db
      .insert(departments)
      .values({
        tenantId,
        name: row.name,
        description: row.description,
        status: "active"
      })
      .returning({ id: departments.id });

    if (created) {
      departmentIds.set(row.name, created.id);
    }
  }

  const staffRows = await db
    .select({ id: staff.id, department: staff.department })
    .from(staff)
    .where(and(eq(staff.tenantId, tenantId), isNotNull(staff.department)));

  for (const member of staffRows) {
    const departmentName = member.department?.trim();
    if (!departmentName) {
      continue;
    }

    let departmentId = departmentIds.get(departmentName);
    if (!departmentId) {
      const [existing] = await db
        .select({ id: departments.id })
        .from(departments)
        .where(and(eq(departments.tenantId, tenantId), eq(departments.name, departmentName)));

      if (existing) {
        departmentId = existing.id;
        departmentIds.set(departmentName, existing.id);
      } else {
        const [created] = await db
          .insert(departments)
          .values({
            tenantId,
            name: departmentName,
            status: "active"
          })
          .returning({ id: departments.id });

        if (created) {
          departmentId = created.id;
          departmentIds.set(departmentName, created.id);
        }
      }
    }

    if (departmentId) {
      await db
        .update(staff)
        .set({ departmentId, updatedAt: new Date() })
        .where(eq(staff.id, member.id));
    }
  }
}
