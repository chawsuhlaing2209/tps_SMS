import type { PdsSubjectColorKey } from "../../../components/pds/palettes";
import { PDS_SUBJECT_COLOR_KEYS } from "../../../components/pds/palettes";
export const SUBJECT_COLOR_OPTIONS = [
  { key: "azure", bg: "var(--pds-color-azure-60)", text: "var(--pds-background-card)" },
  { key: "pomegranate", bg: "var(--pds-color-accent-pomegrate)", text: "var(--pds-background-card)" },
  { key: "purple", bg: "var(--pds-color-accent-purple)", text: "var(--pds-background-card)" },
  { key: "yellow", bg: "var(--pds-color-yellow-500)", text: "var(--pds-background-card)" },
  { key: "green", bg: "var(--pds-color-green-500)", text: "var(--pds-background-card)" },
  { key: "pink", bg: "var(--pds-color-accent-pink)", text: "var(--pds-background-card)" },
  { key: "cyan", bg: "var(--pds-color-cyan-47)", text: "var(--pds-background-card)" },
  { key: "blue", bg: "var(--pds-color-blue-400)", text: "var(--pds-background-card)" }
] as const;

export type SubjectColorKey = (typeof SUBJECT_COLOR_OPTIONS)[number]["key"];

export const SUBJECT_ICON_OPTIONS = [
  { key: "maths", icon: "calculate", labelKey: "subjectIcons.maths" },
  { key: "english", icon: "menu_book", labelKey: "subjectIcons.english" },
  { key: "physics", icon: "science", labelKey: "subjectIcons.physics" },
  { key: "chem", icon: "biotech", labelKey: "subjectIcons.chem" },
  { key: "biology", icon: "microbiology", labelKey: "subjectIcons.biology" },
  { key: "myanmar", icon: "translate", labelKey: "subjectIcons.myanmar" },
  { key: "social_sci", icon: "public", labelKey: "subjectIcons.socialSci" },
  { key: "ict", icon: "computer", labelKey: "subjectIcons.ict" },
  { key: "history", icon: "history_edu", labelKey: "subjectIcons.history" },
  { key: "art", icon: "palette", labelKey: "subjectIcons.art" },
  { key: "music", icon: "music_note", labelKey: "subjectIcons.music" },
  { key: "sport", icon: "sports_soccer", labelKey: "subjectIcons.sport" }
] as const;

export type SubjectIconKey = (typeof SUBJECT_ICON_OPTIONS)[number]["key"];

const ROOM_ACCENT_VARS = SUBJECT_COLOR_OPTIONS.map((entry) => entry.bg);

const SUBJECT_ICON_RULES: { pattern: RegExp; icon: string }[] = [
  { pattern: /math|algebra|calculus|trigonometry|geometry/i, icon: "calculate" },
  { pattern: /english|literature|reading/i, icon: "menu_book" },
  { pattern: /physics/i, icon: "science" },
  { pattern: /chemistry|chem/i, icon: "biotech" },
  { pattern: /biology|life\s*science/i, icon: "microbiology" },
  { pattern: /myanmar|burmese/i, icon: "translate" },
  { pattern: /social|history|civics|geography/i, icon: "public" },
  { pattern: /science/i, icon: "experiment" },
  { pattern: /computer|ict|technology/i, icon: "computer" },
  { pattern: /art|music|drama/i, icon: "palette" },
  { pattern: /physical\s*education|pe\b|sport/i, icon: "sports_soccer" }
];

export function subjectColorByKey(colorKey: string | null | undefined) {
  const match = SUBJECT_COLOR_OPTIONS.find((entry) => entry.key === colorKey);
  return match ?? SUBJECT_COLOR_OPTIONS[0]!;
}

export function subjectColor(name: string, colorKey?: string | null) {
  if (colorKey) {
    return subjectColorByKey(colorKey);
  }
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SUBJECT_COLOR_OPTIONS[Math.abs(hash) % SUBJECT_COLOR_OPTIONS.length]!;
}

export function resolveSubjectChipColorKey(
  name: string,
  colorKey?: string | null
): PdsSubjectColorKey {
  if (colorKey && (PDS_SUBJECT_COLOR_KEYS as readonly string[]).includes(colorKey)) {
    return colorKey as PdsSubjectColorKey;
  }
  return subjectColor(name).key;
}

export function subjectIconByKey(iconKey: string | null | undefined): string {
  const match = SUBJECT_ICON_OPTIONS.find((entry) => entry.key === iconKey);
  return match?.icon ?? "school";
}

export function roomLetter(name: string) {
  const match = name.match(/(?:^|\s|[-–])([A-Za-z])\s*$/);
  return match?.[1]?.toUpperCase() ?? name.charAt(0).toUpperCase();
}

export function roomAccentColor(name: string) {
  const letter = roomLetter(name);
  const code = letter.charCodeAt(0);
  return ROOM_ACCENT_VARS[(code - 65) % ROOM_ACCENT_VARS.length] ?? "var(--pds-color-azure-60)";
}

/** Material Symbols icon for a subject name (Padauk design vocabulary). */
export function subjectIcon(name: string, iconKey?: string | null): string {
  if (iconKey) {
    return subjectIconByKey(iconKey);
  }
  const match = SUBJECT_ICON_RULES.find((rule) => rule.pattern.test(name));
  return match?.icon ?? "school";
}

export function defaultSubjectColorKey(name: string): SubjectColorKey {
  return subjectColor(name).key;
}

export function defaultSubjectIconKey(name: string): SubjectIconKey {
  const icon = subjectIcon(name);
  const match = SUBJECT_ICON_OPTIONS.find((entry) => entry.icon === icon);
  return match?.key ?? "maths";
}
