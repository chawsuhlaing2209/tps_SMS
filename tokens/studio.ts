/**
 * Build design-tokens.css from Figma Variables export (`tokens.json`).
 *
 * Run: npm run tokens:build
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildFigmaTokenMap } from "./figma-export.js";
import {
  buildCompositeTokenMap,
  buildCompositeTypographyCss,
} from "./composite.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const REF_PATTERN = /^\{(.+)\}$/;

/** Namespace for CSS vars emitted from `tokens.json` (PDS design system). */
export const STUDIO_CSS_VAR_PREFIX = "pds";

function slugSegment(segment: string): string {
  return segment
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Drop parent segment when the child already includes it (e.g. padding + padding-large). */
function collapsePathSegments(segments: string[]): string[] {
  if (segments.length === 0) return segments;
  const out: string[] = [segments[0]!];
  for (let i = 1; i < segments.length; i++) {
    const curr = segments[i]!;
    const prev = out[out.length - 1]!;
    if (
      curr === prev ||
      curr.startsWith(`${prev}-`) ||
      curr.split("-").includes(prev)
    ) {
      out[out.length - 1] = curr;
    } else {
      out.push(curr);
    }
  }
  return out;
}

function dedupeConsecutiveHyphenParts(name: string): string {
  const parts = name.split("-").filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    if (out.length > 0 && out[out.length - 1] === part) {
      continue;
    }
    out.push(part);
  }
  return out.join("-");
}

/** Token path → `--pds-*` custom property with redundant layer segments collapsed. */
export function pathToCssVar(path: string): string {
  let normalized = path;
  if (normalized.startsWith("primitives.")) {
    normalized = normalized.slice("primitives.".length);
  } else if (normalized.startsWith("semantic.")) {
    normalized = normalized.slice("semantic.".length);
  } else if (normalized.startsWith("type.")) {
    normalized = normalized.slice("type.".length);
    return `--${STUDIO_CSS_VAR_PREFIX}-type-${dedupeConsecutiveHyphenParts(
      collapsePathSegments(
        normalized.split(".").map(slugSegment).filter(Boolean),
      ).join("-"),
    )}`;
  }

  const segments = normalized
    .split(".")
    .map(slugSegment)
    .filter(Boolean);

  let name = dedupeConsecutiveHyphenParts(
    collapsePathSegments(segments).join("-"),
  );

  if (name.startsWith(`${STUDIO_CSS_VAR_PREFIX}-`)) {
    name = name.slice(STUDIO_CSS_VAR_PREFIX.length + 1);
  } else if (name === STUDIO_CSS_VAR_PREFIX) {
    name = "";
  }

  name = dedupeConsecutiveHyphenParts(name);
  return name
    ? `--${STUDIO_CSS_VAR_PREFIX}-${name}`
    : `--${STUDIO_CSS_VAR_PREFIX}`;
}

function resolveRefPath(refPath: string, byPath: Map<string, string>): string | undefined {
  const candidates = [
    refPath,
    `primitives.${refPath}`,
    `semantic.${refPath}`,
  ];
  for (const candidate of candidates) {
    if (byPath.has(candidate)) return candidate;
  }
  return undefined;
}

function resolveValue(
  raw: string,
  byPath: Map<string, string>,
  cssVarByPath: Map<string, string>,
): string {
  const trimmed = raw.trim();
  if (!REF_PATTERN.test(trimmed)) return trimmed;

  const refPath = REF_PATTERN.exec(trimmed)![1]!.trim();
  const resolvedPath = resolveRefPath(refPath, byPath);
  if (!resolvedPath) return trimmed;

  const resolved = byPath.get(resolvedPath)!;
  if (REF_PATTERN.test(resolved)) {
    return resolveValue(resolved, byPath, cssVarByPath);
  }

  const cssVar = cssVarByPath.get(resolvedPath);
  if (cssVar) return `var(${cssVar})`;
  return resolved;
}

const DERIVED_TOKENS: Array<[string, string]> = [
  [
    "font-family.body-stack",
    '"Hanken Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  ],
  [
    "font-family.display-stack",
    '"Bricolage Grotesque", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  ],
];

const PRIMITIVE_TYPOLOGY_PREFIXES = [
  "primitives.font-size.",
  "primitives.font-weight.",
  "primitives.letter-spacing.",
  "primitives.font-family.",
];

function isPrimitiveTypographyPath(path: string): boolean {
  return PRIMITIVE_TYPOLOGY_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function buildStudioTokenMap(): Map<string, string> {
  const figmaTokens = buildFigmaTokenMap();
  const byPath = new Map<string, string>();

  for (const { path, raw } of figmaTokens.values()) {
    if (isPrimitiveTypographyPath(path)) continue;
    byPath.set(path, raw);
  }

  for (const [path, value] of buildCompositeTokenMap().entries()) {
    byPath.set(path, value);
  }

  for (const [path, value] of DERIVED_TOKENS) {
    byPath.set(path, value);
  }

  const cssVarByPath = new Map<string, string>();
  for (const path of byPath.keys()) {
    cssVarByPath.set(path, pathToCssVar(path));
  }

  for (const [path, raw] of [...byPath.entries()]) {
    if (typeof raw === "string" && REF_PATTERN.test(raw)) {
      byPath.set(path, resolveValue(raw, byPath, cssVarByPath));
    }
  }

  return byPath;
}

export function buildStudioDesignCss(): string {
  const byPath = buildStudioTokenMap();
  const lines: string[] = [
    "/* AUTO-GENERATED — npm run tokens:build — do not edit */",
    ":root {",
    "  color-scheme: light;",
    "",
  ];

  const cssVarOwners = new Map<string, { path: string; value: string }>();
  for (const [path, value] of byPath.entries()) {
    if (value.includes("{missing") || value.includes("{unresolved")) continue;
    if (isPrimitiveTypographyPath(path)) continue;

    const cssVar = pathToCssVar(path);
    const existing = cssVarOwners.get(cssVar);
    const preferCurrent =
      !existing ||
      (existing.path.startsWith("primitives.") && !path.startsWith("primitives."));

    if (preferCurrent) {
      cssVarOwners.set(cssVar, { path, value });
    }
  }

  const groups = new Map<string, Array<[string, string]>>();
  for (const { path, value } of cssVarOwners.values()) {
    const cssVar = pathToCssVar(path);
    const group = path.split(".")[0] ?? "misc";
    const bucket = groups.get(group) ?? [];
    bucket.push([cssVar, value]);
    groups.set(group, bucket);
  }

  for (const group of [...groups.keys()].sort()) {
    lines.push(`  /* ── ${group} ── */`);
    const entries = groups.get(group)!.sort(([a], [b]) => a.localeCompare(b));
    for (const [cssVar, value] of entries) {
      lines.push(`  ${cssVar}: ${value};`);
    }
    lines.push("");
  }

  lines.push("}", "");
  lines.push(buildCompositeTypographyCss());
  return lines.join("\n");
}

export function runStudioTokenBuild(
  outPath = join(ROOT, "apps/web/app/design-tokens.css"),
) {
  const css = buildStudioDesignCss();
  writeFileSync(outPath, css);
  return { cssPath: outPath, tokenCount: buildStudioTokenMap().size };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { cssPath, tokenCount } = runStudioTokenBuild();
  console.log(`Wrote ${cssPath} (${tokenCount} tokens)`);
}
