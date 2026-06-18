/**
 * Build PDS design tokens from Figma Variables export (tokens.json) → design-tokens.css + DTCG JSON.
 *
 * Run: npm run tokens:build
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { findUndefinedTokens, reportUndefinedTokens } from "./check-tokens.js";
import { writeDtcgJson } from "./export-dtcg.js";
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

  const missing = findUndefinedTokens();
  if (missing.length) {
    reportUndefinedTokens(missing);
    console.error(`⚠ Build wrote tokens, but ${missing.length} dangling reference(s) remain (run npm run tokens:check in CI to fail on these).`);
  } else {
    console.log("✓ All --pds-* token references are defined.");
  }
}
