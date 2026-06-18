/**
 * One-time / repeatable migration: replace hardcoded values in globals.css with token vars.
 * Run: npx tsx tokens/migrate-globals.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GLOBALS = join(__dirname, "../apps/web/app/globals.css");

/** Longest-first hex replacements (case-insensitive). */
const COLOR_REPLACEMENTS: Array<[string, string]> = [
  ["#eff6ff", "var(--status-info-bg)"],
  ["#bfdbfe", "var(--status-info-border)"],
  ["#1d4ed8", "var(--status-info-fg)"],
  ["#fef2f2", "var(--status-danger-bg)"],
  ["#fecaca", "var(--status-danger-border)"],
  ["#b91c1c", "var(--status-danger-fg)"],
  ["#f0fdf4", "var(--status-success-bg)"],
  ["#bbf7d0", "var(--status-success-border)"],
  ["#15803d", "var(--status-success-fg)"],
  ["#e7f6d8", "var(--status-success-muted-bg)"],
  ["#3a7d24", "var(--status-success-muted-fg)"],
  ["#e7eefe", "var(--status-info-muted-bg)"],
  ["#2f6cad", "var(--status-info-muted-fg)"],
  ["#fde0db", "var(--status-danger-muted-bg)"],
  ["#fdeccf", "var(--status-warning-muted-bg)"],
  ["#a9711a", "var(--status-warning-muted-fg)"],
  ["#fff7ed", "var(--status-warning-banner-bg)"],
  ["#fdba74", "var(--status-warning-banner-border)"],
  ["#fffbeb", "var(--status-warning-highlight-bg)"],
  ["#fcd34d", "var(--status-warning-highlight-border)"],
  ["#fff8e6", "var(--status-draft-bg)"],
  ["#e8c547", "var(--status-draft-border)"],
  ["#92400e", "var(--status-draft-fg)"],
  ["#dbe9df", "var(--on-shell-faint)"],
  ["#cdddb8", "var(--on-shell-soft)"],
  ["#eef5e4", "var(--on-shell-light)"],
  ["#ffd7d7", "var(--on-shell-error)"],
  ["#102818", "var(--brand-ui-on-brand)"],
  ["#b42318", "var(--danger-strong)"],
  ["#2563eb", "var(--info-strong)"],
  ["#d2e823", "var(--brand-ui-gradient-start)"],
  ["#c5dc1d", "var(--brand-ui-gradient-end)"],
  ["#d7f525", "var(--brand-ui-active)"],
  ["#c5e01f", "var(--brand-ui-hover)"],
  ["#0f2f1f", "var(--shell-ui-gradient-start)"],
  ["#173726", "var(--shell-ui-gradient-end)"],
  ["#9fb3a6", "var(--muted-on-dark)"],
  ["#7f9a8b", "var(--color-spring-green-55)"],
  ["#6f8a7b", "var(--color-spring-green-49)"],
  ["#5f7a6b", "var(--tab-inactive-fg)"],
  ["#f4f7f1", "var(--background)"],
  ["#c0392b", "var(--danger)"],
  ["#ffffff", "var(--card)"],
  ["#fff", "var(--card)"],
];

const SPACING_REPLACEMENTS: Array<[RegExp, string]> = [
  [/(?<![-\d])280px/g, "var(--spacing-280)"],
  [/(?<![-\d])196px/g, "var(--spacing-196)"],
  [/(?<![-\d])180px/g, "var(--spacing-180)"],
  [/(?<![-\d])160px/g, "var(--spacing-160)"],
  [/(?<![-\d])150px/g, "var(--spacing-150)"],
  [/(?<![-\d])108px/g, "var(--spacing-108)"],
  [/(?<![-\d])92px/g, "var(--width-92)"],
  [/(?<![-\d])820px/g, "var(--spacing-820)"],
  [/(?<![-\d])420px/g, "var(--spacing-420)"],
  [/(?<![-\d])240px/g, "var(--width-240)"],
  [/(?<![-\d])220px/g, "var(--spacing-220)"],
  [/(?<![-\d])200px/g, "var(--spacing-200)"],
  [/(?<![-\d])140px/g, "var(--spacing-140)"],
  [/(?<![-\d])960px/g, "var(--breakpoint-lg)"],
  [/(?<![-\d])720px/g, "var(--breakpoint-md)"],
  [/(?<![-\d])640px/g, "var(--breakpoint-sm)"],
  [/(?<![-\d])72px/g, "var(--spacing-72)"],
  [/(?<![-\d])64px/g, "var(--spacing-64)"],
  [/(?<![-\d])56px/g, "var(--size-56)"],
  [/(?<![-\d])46px/g, "var(--size-46)"],
  [/(?<![-\d])45px/g, "var(--spacing-45)"],
  [/(?<![-\d])44px/g, "var(--spacing-44)"],
  [/(?<![-\d])42px/g, "var(--spacing-42)"],
  [/(?<![-\d])40px/g, "var(--space-8)"],
  [/(?<![-\d])38px/g, "var(--spacing-38)"],
  [/(?<![-\d])36px/g, "var(--spacing-36)"],
  [/(?<![-\d])34px/g, "var(--spacing-34)"],
  [/(?<![-\d])32px/g, "var(--spacing-32)"],
  [/(?<![-\d])30px/g, "var(--space-7)"],
  [/(?<![-\d])28px/g, "var(--spacing-28)"],
  [/(?<![-\d])26px/g, "var(--space-6_5)"],
  [/(?<![-\d])25px/g, "var(--font-size-25)"],
  [/(?<![-\d])24px/g, "var(--space-6)"],
  [/(?<![-\d])22px/g, "var(--spacing-22)"],
  [/(?<![-\d])20px/g, "var(--space-5)"],
  [/(?<![-\d])18px/g, "var(--spacing-18)"],
  [/(?<![-\d])17px/g, "var(--spacing-17)"],
  [/(?<![-\d])16px/g, "var(--space-4)"],
  [/(?<![-\d])15px/g, "var(--spacing-15)"],
  [/(?<![-\d])14px/g, "var(--space-3_5)"],
  [/(?<![-\d])13px/g, "var(--space-3_25)"],
  [/(?<![-\d])12px/g, "var(--space-3)"],
  [/(?<![-\d])11px/g, "var(--spacing-11)"],
  [/(?<![-\d])10px/g, "var(--space-2_5)"],
  [/(?<![-\d])9px/g, "var(--spacing-9)"],
  [/(?<![-\d])8px/g, "var(--space-2)"],
  [/(?<![-\d])7px/g, "var(--spacing-7)"],
  [/(?<![-\d])6px/g, "var(--space-1_5)"],
  [/(?<![-\d])5px/g, "var(--spacing-5)"],
  [/(?<![-\d])4px/g, "var(--space-1)"],
  [/(?<![-\d])3px/g, "var(--spacing-3)"],
  [/(?<![-\d])2px/g, "var(--space-0_5)"],
];

const FONT_SIZE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/font-size:\s*30px/g, "font-size: var(--font-size-30)"],
  [/font-size:\s*19px/g, "font-size: var(--font-size-19)"],
  [/font-size:\s*25px/g, "font-size: var(--font-size-25)"],
  [/padding:\s*21px/g, "padding: var(--spacing-21)"],
  [/margin:\s*0\s+-2px/g, "margin: 0 calc(-1 * var(--space-0_5))"],
  [/right:\s*-6px/g, "right: calc(-1 * var(--space-1_5))"],
  [/-25px/g, "calc(-1 * var(--font-size-25))"],
  [/-20px/g, "calc(-1 * var(--space-5))"],
  [/font-size:\s*15px/g, "font-size: var(--font-size-15)"],
  [/font-size:\s*14px/g, "font-size: var(--font-size-14)"],
  [/font-size:\s*13px/g, "font-size: var(--font-size-13)"],
  [/font-size:\s*12px/g, "font-size: var(--font-size-12)"],
];

const RADIUS_REPLACEMENTS: Array<[RegExp, string]> = [
  [/border-radius:\s*999px/g, "border-radius: var(--radius-pill)"],
  [/border-radius:\s*20px/g, "border-radius: var(--radius-card)"],
  [/border-radius:\s*10px/g, "border-radius: var(--radius-input)"],
];

const SHADOW_REPLACEMENTS: Array<[RegExp, string]> = [
  [/rgba\(15,\s*23,\s*42,\s*0\.45\)/g, "var(--shadow-auth)"],
  [/rgba\(37,\s*79,\s*26,\s*0\.18\)/g, "var(--focus-ring)"],
  [/rgba\(10,\s*42,\s*29,\s*0\.5\)/g, "var(--shadow-popover)"],
  [/rgba\(10,\s*42,\s*29,\s*0\.2\)/g, "var(--shadow-panel)"],
  [/rgba\(16,\s*40,\s*24,\s*0\.15\)/g, "var(--shadow-inset-brand)"],
  [/rgba\(255,\s*255,\s*255,\s*0\.72\)/g, "var(--on-shell-alpha-white-72)"],
  [/rgba\(255,\s*255,\s*255,\s*0\.5\)/g, "var(--on-shell-alpha-white-50)"],
  [/rgba\(255,\s*255,\s*255,\s*0\.35\)/g, "var(--on-shell-alpha-white-35)"],
  [/rgba\(255,\s*255,\s*255,\s*0\.2\)/g, "var(--on-shell-alpha-white-20)"],
  [/rgba\(255,\s*255,\s*255,\s*0\.1\)/g, "var(--on-shell-alpha-white-10)"],
  [/rgba\(255,\s*255,\s*255,\s*0\.08\)/g, "var(--on-shell-alpha-white-08)"],
  [/rgba\(255,\s*160,\s*160,\s*0\.45\)/g, "var(--color-danger-glow-45)"],
  [/rgba\(255,\s*160,\s*160,\s*0\.4\)/g, "var(--color-danger-glow-40)"],
];

function migrateCss(source: string): string {
  let css = source;

  for (const [hex, token] of COLOR_REPLACEMENTS) {
    const pattern = new RegExp(hex.replace("#", "#"), "gi");
    css = css.replace(pattern, token);
  }

  for (const [pattern, token] of FONT_SIZE_REPLACEMENTS) {
    css = css.replace(pattern, token);
  }

  for (const [pattern, token] of RADIUS_REPLACEMENTS) {
    css = css.replace(pattern, token);
  }

  for (const [pattern, token] of SHADOW_REPLACEMENTS) {
    css = css.replace(pattern, token);
  }

  for (const [pattern, token] of SPACING_REPLACEMENTS) {
    css = css.replace(pattern, token);
  }

  // Gradients
  css = css.replace(
    /linear-gradient\(135deg,\s*var\(--brand-ui-gradient-start\)\s*0%,\s*var\(--brand-ui-gradient-end\)\s*100%\)/g,
    "linear-gradient(135deg, var(--brand-ui-gradient-start) 0%, var(--brand-ui-gradient-end) 100%)",
  );

  return css;
}

const css = readFileSync(GLOBALS, "utf8");
const migrated = migrateCss(css);
writeFileSync(GLOBALS, migrated);

const remaining = (migrated.match(/#[0-9a-fA-F]{3,8}/g) ?? []).length;
console.log(`Migrated ${GLOBALS}`);
console.log(`Remaining hex literals: ${remaining}`);
