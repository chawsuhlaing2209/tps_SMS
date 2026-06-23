import { describe, expect, it } from "vitest";
import {
  findTeacherScheduleConflict,
  listTeacherScheduleConflicts,
  scheduleConflictKey
} from "./timetable-conflicts.js";

describe("timetable-conflicts", () => {
  const slots = [
    { id: "slot-a", teacherStaffId: "teacher-1", periodId: "period-1", dayOfWeek: 1 },
    { id: "slot-b", teacherStaffId: "teacher-1", periodId: "period-2", dayOfWeek: 1 },
    { id: "slot-c", teacherStaffId: "teacher-2", periodId: "period-1", dayOfWeek: 1 }
  ];

  it("builds a stable schedule key", () => {
    expect(scheduleConflictKey({ teacherStaffId: "t1", periodId: "p1", dayOfWeek: 3 })).toBe(
      "t1:p1:3"
    );
  });

  it("detects when a teacher is already scheduled at the same day and period", () => {
    expect(
      findTeacherScheduleConflict(slots, {
        teacherStaffId: "teacher-1",
        periodId: "period-1",
        dayOfWeek: 1
      })
    ).toMatchObject({ id: "slot-a" });
  });

  it("ignores the slot being updated", () => {
    expect(
      findTeacherScheduleConflict(
        slots,
        { teacherStaffId: "teacher-1", periodId: "period-1", dayOfWeek: 1 },
        "slot-a"
      )
    ).toBeUndefined();
  });

  it("groups duplicate teacher schedules for publish validation", () => {
    const duplicates = listTeacherScheduleConflicts([
      ...slots,
      { id: "slot-d", teacherStaffId: "teacher-1", periodId: "period-1", dayOfWeek: 1 }
    ]);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.map((slot) => slot.id).sort()).toEqual(["slot-a", "slot-d"]);
  });
});
