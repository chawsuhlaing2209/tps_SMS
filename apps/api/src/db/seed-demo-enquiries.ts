import { eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/node-postgres";
import { enquiries, leadActivities } from "./schema.js";

type Db = ReturnType<typeof drizzle>;

const DEMO_ENQUIRIES = [
  {
    prospectiveStudentName: "Min Thu",
    guardianName: "U Kyaw Min",
    guardianPhone: "09-421234567",
    targetGrade: "Grade 1",
    source: "walk-in",
    status: "new" as const,
    notes: "Interested in the morning program and sibling discount."
  },
  {
    prospectiveStudentName: "Hnin Wai",
    guardianName: "Daw May",
    guardianPhone: "09-509876543",
    targetGrade: "KG",
    source: "referral",
    status: "contacted" as const,
    notes: "Referred by an existing family; follow-up call completed."
  },
  {
    prospectiveStudentName: "Aung Paing",
    guardianName: "U Htun",
    guardianPhone: "09-778812345",
    targetGrade: "Grade 5",
    source: "facebook",
    status: "visit_scheduled" as const,
    notes: "Campus visit booked for next week."
  }
] as const;

export async function seedDemoEnquiries(db: Db, tenantId: string) {
  const [existing] = await db
    .select({ id: enquiries.id })
    .from(enquiries)
    .where(eq(enquiries.tenantId, tenantId))
    .limit(1);

  if (existing) {
    return;
  }

  for (const enquiry of DEMO_ENQUIRIES) {
    const [row] = await db
      .insert(enquiries)
      .values({
        tenantId,
        prospectiveStudentName: enquiry.prospectiveStudentName,
        guardianName: enquiry.guardianName,
        guardianPhone: enquiry.guardianPhone,
        targetGrade: enquiry.targetGrade,
        source: enquiry.source,
        status: enquiry.status,
        notes: enquiry.notes
      })
      .returning({ id: enquiries.id });

    if (!row) continue;

    await db.insert(leadActivities).values({
      tenantId,
      enquiryId: row.id,
      activityType: "call",
      notes: "Initial enquiry logged during seed."
    });
  }
}
