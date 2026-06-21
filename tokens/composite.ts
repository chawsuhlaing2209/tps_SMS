/**
 * Parse composite_tokens.json → typography CSS vars + preset classes.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PDS_PREFIX = "pds";

type StudioNode = Record<string, unknown>;

export type CompositeTypographyStyle = {
  path: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  fontFamily: string;
  textTransform: string;
  textDecoration: string;
};

const FONT_STACK_BY_FAMILY: Record<string, string> = {
  "Bricolage Grotesque": "var(--pds-font-family-display-stack)",
  "Hanken Grotesk": "var(--pds-font-family-body-stack)",
};

function slugSegment(segment: string): string {
  return segment
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function isDecomposedProperty(node: unknown): node is { type: string; value: unknown } {
  return (
    typeof node === "object" &&
    node !== null &&
    "type" in node &&
    "value" in node &&
    !("fontSize" in node)
  );
}

function isFontStyleLeaf(node: unknown): node is {
  type: "custom-fontStyle";
  value: Record<string, unknown>;
} {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as { type?: string }).type === "custom-fontStyle" &&
    typeof (node as { value?: unknown }).value === "object"
  );
}

function isTypographyStyleLeaf(node: unknown): boolean {
  if (typeof node !== "object" || node === null) return false;
  return "fontSize" in node && isDecomposedProperty((node as StudioNode).fontSize);
}

function readProperty(node: StudioNode, key: string): unknown {
  const field = node[key];
  if (isDecomposedProperty(field)) return field.value;
  if (typeof field === "number" || typeof field === "string") return field;
  return undefined;
}

function formatFamily(raw: unknown): string {
  const name = String(raw).trim();
  return FONT_STACK_BY_FAMILY[name] ?? `"${name}"`;
}

function formatPx(raw: unknown): string {
  if (typeof raw === "number") return `${raw}px`;
  const trimmed = String(raw).trim();
  if (/^-?\d+(\.\d+)?px$/.test(trimmed)) return trimmed;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return `${trimmed}px`;
  return trimmed;
}

function formatWeight(raw: unknown): string {
  return String(raw);
}

function formatTextTransform(raw: unknown): string {
  const value = String(raw).trim().toLowerCase();
  if (value === "none") return "none";
  return value;
}

function typePropertyVar(stylePath: string, property: string): string {
  const propSlug = property.replace(/([A-Z])/g, "-$1").toLowerCase();
  const name = ["type", ...stylePath.split(".").map(slugSegment), propSlug]
    .filter(Boolean)
    .join("-");
  return `--${PDS_PREFIX}-${name}`;
}

function stylePathToPropertyVar(path: string, property: string): string {
  return `var(${typePropertyVar(path, property)})`;
}

function leafToStyle(path: string, node: StudioNode): CompositeTypographyStyle {
  const fontSize = formatPx(readProperty(node, "fontSize"));
  const fontWeight = formatWeight(readProperty(node, "fontWeight"));
  const lineHeight = formatPx(readProperty(node, "lineHeight"));
  const letterSpacing = formatPx(readProperty(node, "letterSpacing"));
  const fontFamily = formatFamily(readProperty(node, "fontFamily"));
  const textTransform = formatTextTransform(readProperty(node, "textCase"));
  const textDecoration = String(readProperty(node, "textDecoration") ?? "none");

  return {
    path,
    fontSize,
    fontWeight,
    lineHeight,
    letterSpacing,
    fontFamily,
    textTransform,
    textDecoration,
  };
}

function flattenTypography(
  tree: StudioNode,
  prefix = "",
  out: CompositeTypographyStyle[] = [],
): CompositeTypographyStyle[] {
  for (const [key, node] of Object.entries(tree)) {
    if (key.startsWith("$")) continue;
    const segment = slugSegment(key);
    const path = prefix ? `${prefix}.${segment}` : segment;

    if (isFontStyleLeaf(node)) {
      out.push(leafToStyle(path, node.value as StudioNode));
      continue;
    }

    if (isTypographyStyleLeaf(node)) {
      out.push(leafToStyle(path, node as StudioNode));
      continue;
    }

    if (typeof node === "object" && node !== null) {
      flattenTypography(node as StudioNode, path, out);
    }
  }
  return out;
}

function normalizeGradient(raw: {
  gradientType?: string;
  rotation?: number;
  stops?: Array<{ position: number; color: string }>;
}): string {
  const stops = raw.stops ?? [];
  const colors = stops.map((stop) => {
    const hex = stop.color.length >= 7 ? stop.color.slice(0, 7) : stop.color;
    return `${hex} ${Math.round(stop.position * 100)}%`;
  });

  if (raw.gradientType === "radial") {
    const angle = raw.rotation ?? 0;
    return `radial-gradient(${angle}deg, ${colors.join(", ")})`;
  }

  const angle = raw.rotation ?? 180;
  return `linear-gradient(${angle}deg, ${colors.join(", ")})`;
}

function gradientTokenKey(name: string): string {
  const slug = slugSegment(name);
  if (slug === "shell-gradient") return "gradient.shell";
  return `gradient.${slug}`;
}

export function loadCompositeExport(): StudioNode {
  return JSON.parse(
    readFileSync(join(ROOT, "composite_tokens.json"), "utf8"),
  ) as StudioNode;
}

export function buildCompositeTypographyStyles(): CompositeTypographyStyle[] {
  const root = loadCompositeExport();
  const typography = root.typography;
  if (!typography || typeof typography !== "object") return [];
  return flattenTypography(typography as StudioNode);
}

export function buildCompositeTokenMap(): Map<string, string> {
  const out = new Map<string, string>();
  const root = loadCompositeExport();

  for (const style of buildCompositeTypographyStyles()) {
    out.set(`type.${style.path}.font-family`, style.fontFamily);
    out.set(`type.${style.path}.font-size`, style.fontSize);
    out.set(`type.${style.path}.font-weight`, style.fontWeight);
    out.set(`type.${style.path}.line-height`, style.lineHeight);
    out.set(`type.${style.path}.letter-spacing`, style.letterSpacing);
    out.set(`type.${style.path}.text-transform`, style.textTransform);
    out.set(`type.${style.path}.text-decoration`, style.textDecoration);
  }

  const gradientRoot = root.gradient as StudioNode | undefined;
  if (gradientRoot && typeof gradientRoot === "object") {
    for (const [name, node] of Object.entries(gradientRoot)) {
      const gradient = node as {
        type?: string;
        value?: {
          gradientType?: string;
          rotation?: number;
          stops?: Array<{ position: number; color: string }>;
        };
      };
      if (gradient?.value) {
        out.set(gradientTokenKey(name), normalizeGradient(gradient.value));
      }
    }
  }

  return out;
}

export function compositeStyleClassName(path: string): string {
  return `${PDS_PREFIX}-type-${path.split(".").map(slugSegment).join("-")}`;
}

export function buildCompositeTypographyCss(): string {
  const styles = buildCompositeTypographyStyles();
  const lines: string[] = [
    "",
    "/* ── composite typography presets ── */",
  ];

  for (const style of styles) {
    const className = compositeStyleClassName(style.path);
    lines.push(`.${className} {`);
    lines.push(`  font-family: ${stylePathToPropertyVar(style.path, "fontFamily")};`);
    lines.push(`  font-size: ${stylePathToPropertyVar(style.path, "fontSize")};`);
    lines.push(`  font-weight: ${stylePathToPropertyVar(style.path, "fontWeight")};`);
    lines.push(`  line-height: ${stylePathToPropertyVar(style.path, "lineHeight")};`);
    lines.push(`  letter-spacing: ${stylePathToPropertyVar(style.path, "letterSpacing")};`);
    lines.push(`  text-decoration: ${stylePathToPropertyVar(style.path, "textDecoration")};`);
    if (style.textTransform !== "none") {
      lines.push(`  text-transform: ${stylePathToPropertyVar(style.path, "textTransform")};`);
    }
    lines.push("}");
    lines.push("");
  }

  return lines.join("\n");
}

/** CSS var references for shorthand use in app styles. */
export function typeVar(path: string, property: Exclude<keyof CompositeTypographyStyle, "path">): string {
  const map: Record<Exclude<keyof CompositeTypographyStyle, "path">, string> = {
    fontSize: "font-size",
    fontWeight: "font-weight",
    lineHeight: "line-height",
    letterSpacing: "letter-spacing",
    fontFamily: "font-family",
    textTransform: "text-transform",
    textDecoration: "text-decoration",
  };
  return `var(${typePropertyVar(path, map[property])})`;
}
