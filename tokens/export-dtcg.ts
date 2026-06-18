/**
 * Export design-tokens.css as grouped DTCG JSON (Figma-compatible types).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const DTCG_SCHEMA = "https://design-tokens.github.io/community-group/format/";

type FigmaTokenType = "color" | "number" | "string";

export type DtcgToken = {
  $value: unknown;
  $type: FigmaTokenType;
};

export type DtcgGroup = {
  [key: string]: DtcgToken | DtcgGroup;
};

export type DtcgDocument = {
  $schema: string;
  $description: string;
  [key: string]: DtcgToken | DtcgGroup | string;
};

type CssToken = {
  path: string[];
  rawValue: string;
};

function parseCss(css: string): CssToken[] {
  return [...css.matchAll(/^\s+(--[a-z0-9\-/]+):\s*(.+);/gm)].map((match) => ({
    path: match[1]!.slice(2).split("/"),
    rawValue: match[2]!.trim(),
  }));
}

function isColorValue(raw: string): boolean {
  return (
    raw.startsWith("#") ||
    raw.startsWith("rgba(") ||
    raw.startsWith("rgb(") ||
    raw.startsWith("linear-gradient(")
  );
}

function parseNumericValue(raw: string): number | null {
  if (raw === "0") return 0;
  const unitMatch = /^(-?\d+(?:\.\d+)?)(px|rem)$/.exec(raw);
  if (unitMatch) return Number(unitMatch[1]);
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
  return null;
}

function inferType(path: string[], raw: string): FigmaTokenType {
  if (isColorValue(raw)) return "color";
  if (raw.startsWith("var(")) {
    const inner = raw.slice(4, -1);
    if (inner.includes("color") || inner.includes("background") || inner.includes("border") || inner.includes("text") || inner.includes("pds-") || inner.includes("gradient")) {
      return "color";
    }
    if (inner.includes("font-family") || inner.includes("font/")) return "string";
    return "number";
  }
  const numeric = parseNumericValue(raw);
  if (numeric !== null) return "number";
  return "string";
}

function formatValue(raw: string, type: FigmaTokenType): unknown {
  if (raw.startsWith("var(")) return raw;
  if (type === "number") return parseNumericValue(raw) ?? raw;
  return raw;
}

function nestToken(root: DtcgGroup, path: string[], token: DtcgToken): void {
  let cursor: DtcgGroup = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i]!;
    const next = cursor[key];
    if (!next || typeof next !== "object" || "$value" in next) {
      cursor[key] = {};
    }
    cursor = cursor[key] as DtcgGroup;
  }
  cursor[path[path.length - 1]!] = token;
}

function countDtcg(node: DtcgDocument | DtcgGroup | DtcgToken): number {
  if ("$value" in node && "$type" in node) return 1;
  let count = 0;
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$") || typeof child === "string") continue;
    count += countDtcg(child as DtcgGroup | DtcgToken);
  }
  return count;
}

export function buildDtcgDocument(css: string): DtcgDocument {
  const doc: DtcgDocument = {
    $schema: DTCG_SCHEMA,
    $description:
      "Padauk School OS — grouped DTCG export from apps/web/app/design-tokens.css",
  };

  const root: DtcgGroup = {};
  for (const { path, rawValue } of parseCss(css)) {
    if (path[0] === "Legacy aliases (Padauk app compat)") continue;
    const type = inferType(path, rawValue);
    nestToken(root, path, { $type: type, $value: formatValue(rawValue, type) });
  }

  for (const [key, value] of Object.entries(root)) {
    doc[key] = value;
  }

  return doc;
}

export function writeDtcgJson(outPath?: string, css?: string): {
  outPath: string;
  tokenCount: number;
} {
  const target =
    outPath ?? join(ROOT, "apps/web/app/design-tokens.dtcg.json");
  const sourceCss =
    css ?? readFileSync(join(ROOT, "apps/web/app/design-tokens.css"), "utf8");
  const doc = buildDtcgDocument(sourceCss);
  const tokenCount = countDtcg(doc);
  writeFileSync(target, `${JSON.stringify(doc, null, 2)}\n`);
  return { outPath: target, tokenCount };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { outPath, tokenCount } = writeDtcgJson();
  console.log(`Wrote ${outPath} (${tokenCount} tokens)`);
}
