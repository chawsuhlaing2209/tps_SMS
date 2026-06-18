/**
 * Shared token utilities — parse Figma export, resolve references, emit CSS vars.
 */

export type TokenLeaf = { value: string; type?: string };
export interface TokenTree {
  [key: string]: TokenLeaf | TokenTree | string | undefined;
}

export type FlatToken = { path: string; value: string; type?: string };

const REF_PATTERN = /^\{(.+)\}$/;

/** Normalize Figma keys: "spring green" → "spring-green", "s+" → "s-plus", "1_2" → "1.2" */
export function slugify(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/\+/g, "-plus")
    .replace(/_/g, ".")
    .replace(/[^a-z0-9.-]/g, "");
}

/** CSS custom property segment — keeps underscores (e.g. 0_5), never emits dots. */
export function cssVarSegment(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/\+/g, "-plus")
    .replace(/[^a-z0-9._-]/g, "");
}

export function isLeaf(node: unknown): node is TokenLeaf {
  return typeof node === "object" && node !== null && "value" in node;
}

export function isTokenTree(node: unknown): node is TokenTree {
  return typeof node === "object" && node !== null && !isLeaf(node);
}

/** Flatten a nested token tree to dot-paths (skips $metadata keys). */
export function flattenTokenTree(
  tree: TokenTree,
  prefix = "",
): FlatToken[] {
  const out: FlatToken[] = [];
  for (const [key, node] of Object.entries(tree)) {
    if (key.startsWith("$")) continue;
    const path = prefix ? `${prefix}.${slugify(key)}` : slugify(key);
    if (isLeaf(node)) {
      out.push({ path, value: String(node.value), type: node.type });
    } else if (isTokenTree(node)) {
      out.push(...flattenTokenTree(node, path));
    }
  }
  return out;
}

/** Parse Figma Variables export (`tokens.json` → `light` mode). */
export function parseFigmaExport(
  figmaExport: Record<string, unknown>,
  mode = "light",
): FlatToken[] {
  const modeTree = figmaExport[mode];
  if (!isTokenTree(modeTree)) {
    throw new Error(`Figma export missing mode "${mode}"`);
  }
  return flattenTokenTree(modeTree).map((token) => ({
    ...token,
    value: formatRawValue(token.value, token.type, token.path),
  }));
}

/** Convert Figma raw values to CSS-ready strings. */
export function formatRawValue(
  value: string,
  type?: string,
  path?: string,
): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("#") || trimmed.startsWith("var(")) return trimmed;
  if (type === "color") return trimmed;

  if (path?.startsWith("font-family.") || type === "fontFamilies") {
    if (trimmed.includes(",") || trimmed.startsWith('"')) return trimmed;
    if (/\s/.test(trimmed)) return `"${trimmed}"`;
    return trimmed;
  }

  if (path?.startsWith("font-weight.")) return trimmed;

  if (path?.startsWith("opacity.") || type === "opacity") {
    const n = Number(trimmed);
    return n > 1 ? String(n / 100) : trimmed;
  }

  if (type === "text") return trimmed;

  if (/^-?\d+(\.\d+)?(px|rem|em|%|vh|vw|ch|ex)$/.test(trimmed)) return trimmed;

  if (type === "number" || type === "dimension" || /^\d+(\.\d+)?$/.test(trimmed)) {
    return `${trimmed}px`;
  }

  return trimmed;
}

export function flatTokensToTree(tokens: FlatToken[]): TokenTree {
  const root: TokenTree = {};
  for (const { path, value, type } of tokens) {
    const parts = path.split(".");
    let cursor: TokenTree = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i]!;
      const next = cursor[part];
      if (!isTokenTree(next)) {
        cursor[part] = {};
      }
      cursor = cursor[part] as TokenTree;
    }
    const leafKey = parts[parts.length - 1]!;
    cursor[leafKey] = type ? { value, type } : { value };
  }
  return root;
}

export function flattenToMap(tokens: FlatToken[]): Map<string, string> {
  return new Map(tokens.map((t) => [t.path, t.value]));
}

export function resolveRef(
  value: string,
  tokenMap: Map<string, string>,
): string {
  const match = REF_PATTERN.exec(value.trim());
  if (!match) return value;
  const resolved = tokenMap.get(match[1]!);
  if (!resolved) return value;
  return resolveRef(resolved, tokenMap);
}

/** Primitive path → `--color-spring-green-10` */
export function primitivePathToCssVar(path: string): string {
  return `--${path.split(".").map(slugify).join("-")}`;
}

/** Semantic leaf path → `--background` or `--structure-banner-radius` */
export function semanticPathToCssVar(section: string, path: string): string {
  const name = path.split(".").map(cssVarSegment).join("-");
  if (section === "color") return `--${name}`;
  if (section === "spacing") return `--space-${name}`;
  if (section === "radius") return `--radius-${name}`;
  if (section === "layout") return `--layout-${name}`;
  if (section === "font") return `--font-${name}`;
  if (section === "component") return `--${name}`;
  return `--${section}-${name}`;
}

export function flattenSemanticLeaves(
  tree: TokenTree,
  prefix = "",
): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [key, node] of Object.entries(tree)) {
    if (key.startsWith("$")) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (isLeaf(node)) {
      out.push([path, node.value]);
    } else if (isTokenTree(node)) {
      out.push(...flattenSemanticLeaves(node, path));
    }
  }
  return out;
}

export function refToVar(value: string, tokenMap: Map<string, string>): string {
  const match = REF_PATTERN.exec(value.trim());
  if (!match) return value;
  const path = match[1]!;
  if (tokenMap.has(path)) {
    return `var(${primitivePathToCssVar(path)})`;
  }
  return `var(${semanticPathToCssVar("color", path.replace(/\./g, "-"))})`;
}
