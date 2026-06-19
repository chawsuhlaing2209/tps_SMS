/** Categorical subject colors — solid fill chips & active subject tabs. */
export const PDS_SUBJECT_COLOR_KEYS = [
  "azure",
  "pomegranate",
  "purple",
  "yellow",
  "green",
  "pink",
  "cyan",
  "blue",
] as const;

export type PdsSubjectColorKey = (typeof PDS_SUBJECT_COLOR_KEYS)[number];

/** Semantic icon-tile tints — light bg + matching icon color. */
export const PDS_ICON_TILE_TONES = [
  "blue",
  "green",
  "orange",
  "red",
  "purple",
] as const;

export type PdsIconTileTone = (typeof PDS_ICON_TILE_TONES)[number];

/** Finance / roster status pill semantics. */
export const PDS_STATUS_PILL_TONES = [
  "paid",
  "partial",
  "overdue",
  "due",
  "scholarship",
  "neutral",
] as const;

export type PdsStatusPillTone = (typeof PDS_STATUS_PILL_TONES)[number];

/** Attendance toggle states. */
export const PDS_ATTENDANCE_STATES = ["present", "late", "absent"] as const;

export type PdsAttendanceState = (typeof PDS_ATTENDANCE_STATES)[number];

/** Grade letter chips — tinted bg + saturated text. */
export const PDS_GRADE_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

export type PdsGradeLetter = (typeof PDS_GRADE_LETTERS)[number];

export const ATTENDANCE_ICONS: Record<PdsAttendanceState, string> = {
  present: "check",
  late: "schedule",
  absent: "close",
};
