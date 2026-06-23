export type BenefitIconTone = "azure" | "green" | "purple" | "amber" | "coral" | "pink";

const ICON_TONE_BY_NAME: Record<string, BenefitIconTone> = {
  redeem: "green",
  home_work: "azure",
  directions_bus: "azure",
  restaurant: "amber",
  health_and_safety: "green",
  school: "purple",
  fitness_center: "pink",
  savings: "green",
  card_giftcard: "green",
  trending_up: "azure",
  event_available: "green",
  workspace_premium: "purple",
  military_tech: "amber",
  celebration: "coral",
  emoji_events: "amber",
  star: "amber",
  volunteer_activism: "pink"
};

export function benefitIconTone(icon: string | null | undefined): BenefitIconTone {
  return ICON_TONE_BY_NAME[icon ?? ""] ?? "azure";
}
