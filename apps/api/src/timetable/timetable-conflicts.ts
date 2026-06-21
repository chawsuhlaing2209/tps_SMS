/** A teacher may only appear in one lesson per period and day of week. */
export type TimetableSlotScheduleKey = {
  teacherStaffId: string;
  periodId: string;
  dayOfWeek: number;
};

export function scheduleConflictKey(input: TimetableSlotScheduleKey) {
  return `${input.teacherStaffId}:${input.periodId}:${input.dayOfWeek}`;
}

export function findTeacherScheduleConflict<T extends TimetableSlotScheduleKey & { id: string }>(
  slots: T[],
  candidate: TimetableSlotScheduleKey,
  excludeSlotId?: string
): T | undefined {
  const key = scheduleConflictKey(candidate);
  return slots.find(
    (slot) =>
      slot.id !== excludeSlotId &&
      scheduleConflictKey(slot) === key
  );
}

export function listTeacherScheduleConflicts<T extends TimetableSlotScheduleKey & { id: string }>(
  slots: T[]
): T[][] {
  const buckets = new Map<string, T[]>();

  for (const slot of slots) {
    if (!slot.teacherStaffId) continue;
    const key = scheduleConflictKey(slot);
    const bucket = buckets.get(key) ?? [];
    bucket.push(slot);
    buckets.set(key, bucket);
  }

  return [...buckets.values()].filter((group) => group.length > 1);
}
