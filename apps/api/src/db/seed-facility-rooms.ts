import { and, eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/node-postgres";
import { facilityRooms } from "./schema.js";

type Db = ReturnType<typeof drizzle>;

const DEMO_FACILITY_ROOMS = [
  {
    name: "Main Building — Room 101",
    capacity: 30,
    note: "Ground floor, east wing. Enter from the main corridor; first door on the right after reception."
  },
  {
    name: "Main Building — Room 102",
    capacity: 30,
    note: "Ground floor, east wing. Adjacent to Room 101; shared restroom at the end of the hall."
  },
  {
    name: "Kindergarten Wing — Room A",
    capacity: 24,
    note: "Ground floor, kindergarten block. Low tables and play corner; use the side entrance near the garden."
  },
  {
    name: "Science Lab A",
    capacity: 28,
    note: "Second floor, west wing. Safety goggles stored in the cabinet by the door; no food or drink inside."
  },
  {
    name: "Computer Lab",
    capacity: 32,
    note: "Third floor, IT block. Log in with student ID; report faulty machines to the IT office."
  },
  {
    name: "Auditorium",
    capacity: 200,
    note: "Ground floor, central building. Stage access via backstage door; AV controls at rear booth."
  },
  {
    name: "Sports Hall",
    capacity: 120,
    note: "Annex building behind the main field. Indoor shoes only; equipment room key from PE office."
  }
] as const;

export async function seedFacilityRooms(db: Db, tenantId: string) {
  for (const room of DEMO_FACILITY_ROOMS) {
    const [existing] = await db
      .select({ id: facilityRooms.id })
      .from(facilityRooms)
      .where(and(eq(facilityRooms.tenantId, tenantId), eq(facilityRooms.name, room.name)));

    if (existing) {
      await db
        .update(facilityRooms)
        .set({
          capacity: room.capacity,
          note: room.note,
          status: "active"
        })
        .where(eq(facilityRooms.id, existing.id));
      continue;
    }

    await db.insert(facilityRooms).values({
      tenantId,
      name: room.name,
      capacity: room.capacity,
      note: room.note,
      status: "active"
    });
  }
}
