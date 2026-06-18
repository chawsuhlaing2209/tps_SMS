/**
 * Guardrail: scan every `var(--pds-*)` reference in the web app's CSS and report
 * any token that is not defined in the generated design-tokens.css.
 *
 * An undefined custom property silently drops the declaration (and a malformed
 * one can break the whole cascade), so this catches the class of bug where a
 * renamed/removed token leaves dangling references.
 *
 * Run standalone: npm run tokens:check  (exits non-zero if anything is missing)
 * Also invoked automatically at the end of npm run tokens:build (warns).
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const WEB = join(ROOT, "apps/web");
const TOKENS_CSS = join(WEB, "app/design-tokens.css");

const SCAN_DIRS = [join(WEB, "app"), join(WEB, "components")];

export type MissingToken = { token: string; files: string[] };

function collectCssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".css")) continue;
    const full = join(entry.parentPath ?? (entry as { path?: string }).path ?? dir, entry.name);
    if (full === TOKENS_CSS) continue;
    out.push(full);
  }
  return out;
}

export function findUndefinedTokens(): MissingToken[] {
  const tokensCss = readFileSync(TOKENS_CSS, "utf8");
  const defined = new Set(
    [...tokensCss.matchAll(/(--pds-[a-z0-9-]+)\s*:/g)].map((m) => m[1])
  );

  const missing = new Map<string, Set<string>>();
  for (const dir of SCAN_DIRS) {
    for (const file of collectCssFiles(dir)) {
      const css = readFileSync(file, "utf8");
      for (const m of css.matchAll(/var\((--pds-[a-z0-9-]+)\s*[,)]/g)) {
        const token = m[1];
        if (!defined.has(token)) {
          if (!missing.has(token)) missing.set(token, new Set());
          missing.get(token)!.add(relative(ROOT, file));
        }
      }
    }
  }

  return [...missing.entries()]
    .map(([token, files]) => ({ token, files: [...files].sort() }))
    .sort((a, b) => a.token.localeCompare(b.token));
}

export function reportUndefinedTokens(missing: MissingToken[]): void {
  if (!missing.length) return;
  console.error(`\n✖ ${missing.length} undefined --pds-* token reference(s):`);
  for (const { token, files } of missing) {
    console.error(`  ${token}\n    ↳ ${files.join("\n    ↳ ")}`);
  }
  console.error("\nFix the reference or add the token to tokens.json, then rebuild.\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const missing = findUndefinedTokens();
  reportUndefinedTokens(missing);
  if (missing.length) process.exit(1);
  console.log("✓ All --pds-* token references are defined.");
}
