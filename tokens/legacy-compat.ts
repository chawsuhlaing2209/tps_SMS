/**
 * Emit Padauk legacy CSS vars (--space-*, --brand-dark, --status-*, …) from
 * tokens/primitives.json + tokens/semantic.json so globals.css keeps working
 * alongside the new Figma slash tokens from tokens.json.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  flattenSemanticLeaves,
  flattenToMap,
  flattenTokenTree,
  formatRawValue,
  semanticPathToCssVar,
  type TokenTree,
} from "./lib.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadJson(path: string): TokenTree {
  return JSON.parse(readFileSync(path, "utf8")) as TokenTree;
}

function primitivePathToLegacyVar(path: string): string {
  return `--${path.split(".").join("-")}`;
}

function semanticLeafToLegacyVar(path: string): string {
  const section = path.split(".")[0] ?? "misc";
  const rest = path.slice(section.length + 1);
  return semanticPathToCssVar(section, rest);
}

export function buildLegacyCompatAliases(): Array<[string, string]> {
  const primitives = loadJson(join(ROOT, "tokens/primitives.json"));
  const semantic = loadJson(join(ROOT, "tokens/semantic.json"));

  const primitiveFlat = flattenTokenTree(primitives).map((token) => ({
    ...token,
    value: formatRawValue(token.value, token.type, token.path),
  }));

  const primitiveMap = flattenToMap(primitiveFlat);

  const resolve = (value: string, seen = new Set<string>()): string => {
    const trimmed = value.trim();
    const match = /^\{(.+)\}$/.exec(trimmed);
    if (!match) return trimmed;
    const ref = match[1]!;
    if (seen.has(ref)) return trimmed;
    seen.add(ref);
    const candidates = [ref, ref.replace(/^color\./, ""), `color.${ref}`];
    for (const key of candidates) {
      const next = primitiveMap.get(key);
      if (next) return resolve(next, seen);
    }
    return trimmed;
  };

  const out = new Map<string, string>();

  for (const { path, value } of primitiveFlat) {
    out.set(primitivePathToLegacyVar(path), resolve(value));
  }

  for (const [path, value] of flattenSemanticLeaves(semantic)) {
    out.set(semanticLeafToLegacyVar(path), resolve(value));
  }

  return [...out.entries()].sort(([a], [b]) => a.localeCompare(b));
}
