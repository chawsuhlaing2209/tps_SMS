ALTER TABLE "classrooms" ADD COLUMN IF NOT EXISTS "facility_room_id" uuid REFERENCES "facility_rooms"("id");
