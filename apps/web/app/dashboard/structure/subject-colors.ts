/** Category palette — resolved from design tokens at runtime in the browser. */
const SUBJECT_COLOR_VARS = [
  { bg: "var(--cat-blue)", text: "var(--card)" },
  { bg: "var(--cat-coral)", text: "var(--card)" },
  { bg: "var(--cat-lilac)", text: "var(--card)" },
  { bg: "var(--cat-mustard)", text: "var(--card)" },
  { bg: "var(--cat-green)", text: "var(--card)" },
  { bg: "var(--cat-pink)", text: "var(--card)" },
  { bg: "var(--cat-teal)", text: "var(--card)" },
  { bg: "var(--cat-sky)", text: "var(--card)" },
] as const;

const ROOM_ACCENT_VARS = SUBJECT_COLOR_VARS.map((entry) => entry.bg);

export function subjectColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SUBJECT_COLOR_VARS[Math.abs(hash) % SUBJECT_COLOR_VARS.length]!;
}

export function roomLetter(name: string) {
  const match = name.match(/(?:^|\s|[-–])([A-Za-z])\s*$/);
  return match?.[1]?.toUpperCase() ?? name.charAt(0).toUpperCase();
}

export function roomAccentColor(name: string) {
  const letter = roomLetter(name);
  const code = letter.charCodeAt(0);
  return ROOM_ACCENT_VARS[(code - 65) % ROOM_ACCENT_VARS.length] ?? "var(--cat-blue)";
}

const SUBJECT_ICON_RULES: { pattern: RegExp; icon: string }[] = [
  { pattern: /math|algebra|calculus|trigonometry|geometry/i, icon: "calculate" },
  { pattern: /english|literature|reading/i, icon: "menu_book" },
  { pattern: /physics/i, icon: "science" },
  { pattern: /chemistry/i, icon: "biotech" },
  { pattern: /biology|life\s*science/i, icon: "microbiology" },
  { pattern: /myanmar|burmese/i, icon: "translate" },
  { pattern: /social|history|civics|geography/i, icon: "public" },
  { pattern: /science/i, icon: "experiment" },
  { pattern: /computer|ict|technology/i, icon: "computer" },
  { pattern: /art|music|drama/i, icon: "palette" },
  { pattern: /physical\s*education|pe\b/i, icon: "sports_soccer" },
];

/** Material Symbols icon for a subject name (Padauk design vocabulary). */
export function subjectIcon(name: string): string {
  const match = SUBJECT_ICON_RULES.find((rule) => rule.pattern.test(name));
  return match?.icon ?? "school";
}
