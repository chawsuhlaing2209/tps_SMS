/**
 * Sync primitives from tokens.json (Figma export) + tokens/extensions.json.
 *
 * Run via: npm run tokens:build
 * Output:  tokens/primitives.json (generated — do not hand-edit)
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import extensions from "./extensions.json";
import {
  flatTokensToTree,
  flattenTokenTree,
  formatRawValue,
  isTokenTree,
  parseFigmaExport,
  type FlatToken,
  type TokenTree,
} from "./lib.js";

import figmaExport from "../tokens.json";

const __dirname = dirname(fileURLToPath(import.meta.url));

function extensionTokens(): FlatToken[] {
  return flattenTokenTree(extensions as TokenTree).map((token) => ({
    ...token,
    value: formatRawValue(token.value, token.type, token.path),
  }));
}

export function buildPrimitives(): TokenTree {
  const figmaTokens = parseFigmaExport(figmaExport as Record<string, unknown>);
  const extraTokens = extensionTokens();

  const merged = new Map<string, FlatToken>();
  for (const token of figmaTokens) merged.set(token.path, token);
  for (const token of extraTokens) merged.set(token.path, token);

  return flatTokensToTree([...merged.values()]);
}

export function writePrimitivesJson(outPath = join(__dirname, "primitives.json")) {
  const tree = buildPrimitives();
  const payload = {
    $description:
      "AUTO-GENERATED from tokens.json + extensions.json. Run npm run tokens:build.",
    $source: ["tokens.json", "tokens/extensions.json"],
    ...tree,
  };
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  return outPath;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = writePrimitivesJson();
  const count = flattenTokenTree(buildPrimitives()).length;
  console.log(`Wrote ${out} (${count} primitive tokens)`);
}
