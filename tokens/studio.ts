/**
 * Parse Tokens Studio export (tokens.json) → flat token map + design-tokens.css
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildLegacyCompatAliases } from "./legacy-compat.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const REF_PATTERN = /^\{(.+)\}$/;

type StudioNode = Record<string, unknown>;

function slugKey(key: string): string {
  return key.trim();
}

function isStudioLeaf(node: unknown): node is { type?: string; value: unknown } {
  return (
    typeof node === "object" &&
    node !== null &&
    "value" in node &&
    !Array.isArray(node)
  );
}

function isGradientLeaf(node: unknown): node is {
  type: string;
  value: { gradientType?: string; rotation?: number; stops?: Array<{ position: number; color: string }> };
} {
  return (
    isStudioLeaf(node) &&
    (node as { type?: string }).type === "custom-gradient" &&
    typeof (node as { value?: unknown }).value === "object"
  );
}

function flattenStudio(
  tree: StudioNode,
  prefix = "",
  out: Array<{ path: string; type?: string; raw: unknown }> = [],
): Array<{ path: string; type?: string; raw: unknown }> {
  for (const [key, node] of Object.entries(tree)) {
    if (key.startsWith("$")) continue;
    const segment = slugKey(key).replace(/\s+/g, "-");
    const path = prefix ? `${prefix}.${segment}` : segment;

    if (isGradientLeaf(node)) {
      out.push({ path, type: "gradient", raw: node.value });
      continue;
    }

    if (isStudioLeaf(node)) {
      const leafType = (node as { type?: string }).type;
      if (leafType === "custom-fontStyle") {
        continue;
      }
      out.push({ path, type: leafType, raw: node.value });
      continue;
    }

    if (typeof node === "object" && node !== null) {
      flattenStudio(node as StudioNode, path, out);
    }
  }
  return out;
}

function normalizeColor(value: unknown): string {
  if (typeof value !== "string") return String(value);
  const trimmed = value.trim();
  if (/^#[0-9a-f]{8}$/i.test(trimmed) && trimmed.slice(7, 9).toLowerCase() === "ff") {
    return trimmed.slice(0, 7);
  }
  return trimmed;
}

function normalizeRawValue(type: string | undefined, raw: unknown, path = ""): string {
  if (typeof raw === "number") {
    if (path.includes("font-weight") || path.includes("fontWeight")) return String(raw);
    if (type === "dimension" || type === "number") return `${raw}px`;
    return String(raw);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (REF_PATTERN.test(trimmed)) return trimmed;
    if (type === "color") return normalizeColor(trimmed);
    if (type === "string" || type === "fontFamilies" || type === "text") {
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
      return trimmed;
    }
    if (type === "dimension" || type === "number") {
      if (/^\d+(\.\d+)?$/.test(trimmed)) return `${trimmed}px`;
      return trimmed;
    }
    return trimmed;
  }
  if (type === "gradient" && typeof raw === "object" && raw !== null) {
    const gradient = raw as {
      gradientType?: string;
      rotation?: number;
      stops?: Array<{ position: number; color: string }>;
    };
    const stops = gradient.stops ?? [];
    const colors = stops.map(
      (stop) => `${normalizeColor(stop.color)} ${Math.round(stop.position * 100)}%`,
    );
    const angle = gradient.rotation ?? 180;
    return `linear-gradient(${angle}deg, ${colors.join(", ")})`;
  }
  return String(raw);
}

/** Tokens Studio path → valid CSS custom property (hyphen groups, Figma-aligned). */
export function pathToCssVar(path: string): string {
  let normalized = path;
  if (normalized.startsWith("semantic.")) {
    normalized = normalized.slice("semantic.".length);
  } else if (normalized.startsWith("primitives.")) {
    normalized = normalized.slice("primitives.".length);
  } else if (normalized.startsWith("gradient.")) {
    normalized = normalized.slice("gradient.".length);
  } else if (normalized.startsWith("font.")) {
    normalized = normalized.slice("font.".length);
  } else if (normalized.startsWith("typography.")) {
    normalized = normalized.slice("typography.".length);
  }
  const name = normalized
    .replace(/\./g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `--${name}`;
}

function normalizeRefPath(refPath: string): string {
  return refPath.replace(/\s+/g, "-");
}

function resolveRefPath(refPath: string, byPath: Map<string, string>): string | undefined {
  const normalized = normalizeRefPath(
    refPath
      .replace(/^compact\./, "comfort.")
      .replace(/^border\.border-width\.pds-border-width-base$/, "border.width.pdi-border-width"),
  );
  const candidates = [
    normalizeRefPath(refPath),
    normalized,
    `primitives.${normalizeRefPath(refPath)}`,
    `primitives.${normalized}`,
    `semantic.${normalizeRefPath(refPath)}`,
    `semantic.${normalized}`,
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

function loadExportTree(): StudioNode {
  return JSON.parse(readFileSync(join(ROOT, "tokens.json"), "utf8")) as StudioNode;
}

export function buildStudioTokenMap(): Map<string, string> {
  const flat = flattenStudio(loadExportTree());
  const byPath = new Map<string, string>();

  for (const { path, type, raw } of flat) {
    byPath.set(path, normalizeRawValue(type, raw, path));
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

  const groups = new Map<string, Array<[string, string]>>();
  for (const [path, value] of byPath.entries()) {
    if (path.startsWith("typography.")) continue;
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

  lines.push("  /* ── Legacy aliases (Padauk app compat) ── */");
  for (const [cssVar, value] of buildLegacyCompatAliases()) {
    lines.push(`  ${cssVar}: ${value};`);
  }
  lines.push(`  --gradient-shell: var(--shell-gradient);`);
  lines.push(`  --font-size-28: 28px;`);

  lines.push("}", "");
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
