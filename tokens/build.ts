/**
 * Build design tokens from Tokens Studio export (tokens.json) → design-tokens.css + DTCG JSON.
 *
 * Run: npm run tokens:build
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { writeDtcgJson } from "./export-dtcg.js";
import { buildLegacyCompatAliases } from "./legacy-compat.js";
import { buildStudioDesignCss, runStudioTokenBuild } from "./studio.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

export function buildDesignCss(): string {
  return buildStudioDesignCss();
}

export function runTokenBuild() {
  const { cssPath, tokenCount } = runStudioTokenBuild();
  const css = buildStudioDesignCss();
  writeFileSync(cssPath, css);
  const { outPath: dtcgPath, tokenCount: dtcgCount } = writeDtcgJson(undefined, css);
  return { cssPath, dtcgPath, tokenCount, dtcgTokenCount: dtcgCount };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { cssPath, dtcgPath, tokenCount, dtcgTokenCount } = runTokenBuild();
  console.log(`Wrote ${cssPath} (${tokenCount} studio tokens)`);
  console.log(`Wrote ${dtcgPath} (${dtcgTokenCount} DTCG tokens)`);
}
