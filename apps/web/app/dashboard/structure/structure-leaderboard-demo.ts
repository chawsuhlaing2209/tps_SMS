export type LeaderboardTrend = "up" | "down" | "flat";

export type LeaderboardEntry = {
  rank: number;
  name: string;
  initials: string;
  avatarColor: string;
  room: string;
  aggregate: number;
  trend: LeaderboardTrend;
  trendDelta: number;
};

export const LEADERBOARD_DEMO_MONTHS = ["june", "july", "august"] as const;
export type LeaderboardDemoMonth = (typeof LEADERBOARD_DEMO_MONTHS)[number];

export const LEADERBOARD_DEMO_CHIEF = "Saya Aung Kyaw Moe";
export const LEADERBOARD_DEMO_STREAM = "Science stream";

/** Static demo rows matching Figma node 91:14393 — replaced by API later. */
export const LEADERBOARD_DEMO_ENTRIES: LeaderboardEntry[] = [
  {
    rank: 1,
    name: "Mg Lin Htet Naing",
    initials: "LN",
    avatarColor: "var(--pds-color-accent-purple)",
    room: "Room 11-B",
    aggregate: 85,
    trend: "down",
    trendDelta: 8
  },
  {
    rank: 2,
    name: "Ma May Thu Kyaw",
    initials: "MT",
    avatarColor: "var(--pds-color-accent-pomegrate)",
    room: "Room 11-A",
    aggregate: 83,
    trend: "up",
    trendDelta: 18
  },
  {
    rank: 3,
    name: "Mg Thant Sin Oo",
    initials: "TS",
    avatarColor: "var(--pds-color-green-500)",
    room: "Room 11-C",
    aggregate: 83,
    trend: "up",
    trendDelta: 1
  },
  {
    rank: 4,
    name: "Mg Wai Yan Phyo",
    initials: "WP",
    avatarColor: "var(--pds-color-blue-400)",
    room: "Room 11-B",
    aggregate: 83,
    trend: "down",
    trendDelta: 14
  },
  {
    rank: 5,
    name: "Ma Aye Chan Moe",
    initials: "AC",
    avatarColor: "var(--pds-color-cyan-47)",
    room: "Room 11-C",
    aggregate: 79,
    trend: "down",
    trendDelta: 6
  },
  {
    rank: 6,
    name: "Ma Hnin Wai Lwin",
    initials: "HW",
    avatarColor: "var(--pds-color-accent-pink)",
    room: "Room 11-A",
    aggregate: 78,
    trend: "up",
    trendDelta: 3
  },
  {
    rank: 7,
    name: "Mg Zaw Min Htet",
    initials: "ZM",
    avatarColor: "var(--pds-color-yellow-500)",
    room: "Room 11-B",
    aggregate: 77,
    trend: "flat",
    trendDelta: 0
  }
];
