/**
 * Parse Figma Variables collections export (`tokens.json`) into flat token paths + CSS values.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Local fallbacks when Figma library aliases cannot be resolved from this export. */
const UNRESOLVED_ALIAS_FALLBACKS: Record<string, string> = {
  "button.padding-x": "{primitives.padding.x-large}",
  "button.padding-y": "{primitives.padding.large}",
  "button.pec-border": "{primitives.border-weight.1}",
};

type FigmaColor = { r: number; g: number; b: number; a?: number };
type FigmaAlias = { type: "VARIABLE_ALIAS"; id: string };

type FigmaVariable = {
  id: string;
  name: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING";
  valuesByMode: Record<string, unknown>;
  variableCollectionId: string;
};

type FigmaCollection = {
  id: string;
  name: string;
  defaultModeId: string;
  variables: FigmaVariable[];
};

type FigmaExport = {
  collections: FigmaCollection[];
};

export type FlatFigmaToken = {
  path: string;
  collection: string;
  type: FigmaVariable["resolvedType"];
  raw: string;
};

function loadExport(): FigmaExport {
  return JSON.parse(readFileSync(join(ROOT, "tokens.json"), "utf8")) as FigmaExport;
}

function isAlias(value: unknown): value is FigmaAlias {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as FigmaAlias).type === "VARIABLE_ALIAS"
  );
}

function isColor(value: unknown): value is FigmaColor {
  return (
    typeof value === "object" &&
    value !== null &&
    "r" in value &&
    "g" in value &&
    "b" in value
  );
}

function rgbaToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = color.a ?? 1;

  const hex = `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;

  if (a >= 0.999) return hex;

  const alpha = Math.round(a * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${alpha}`;
}

function figmaNameToPath(collectionName: string, name: string): string {
  const segments = name.split("/").map((segment) => segment.trim()).filter(Boolean);
  if (collectionName === "semantic") {
    return segments.join(".");
  }
  return [collectionName, ...segments].join(".");
}

function formatScalar(
  type: FigmaVariable["resolvedType"],
  value: unknown,
  path: string,
): string {
  if (type === "COLOR" && isColor(value)) {
    return rgbaToHex(value);
  }
  if (type === "STRING" && typeof value === "string") {
    if (path.includes("font-family") && !value.includes(",") && !value.startsWith('"')) {
      return `"${value}"`;
    }
    return value;
  }
  if (type === "FLOAT" && typeof value === "number") {
    if (path.includes("font-weight") || path.includes("opacity")) {
      return String(value);
    }
    return `${value}px`;
  }
  return String(value);
}

export function buildFigmaTokenMap(): Map<string, FlatFigmaToken> {
  const exportData = loadExport();
  const variableById = new Map<string, FigmaVariable>();
  const collectionById = new Map<string, FigmaCollection>();
  const keyByHash = new Map<string, FigmaVariable>();

  for (const collection of exportData.collections) {
    collectionById.set(collection.id, collection);
    for (const variable of collection.variables) {
      variableById.set(variable.id, variable);
      keyByHash.set((variable as FigmaVariable & { key?: string }).key ?? "", variable);
    }
  }

  const resolveRaw = (variableId: string, seen = new Set<string>()): string => {
    if (seen.has(variableId)) return `{unresolved:${variableId}}`;
    seen.add(variableId);

    const variable = variableById.get(variableId);
    if (!variable) return `{missing:${variableId}}`;

    const collection = collectionById.get(variable.variableCollectionId);
    if (!collection) return `{missing-collection:${variableId}}`;

    const modeValue = variable.valuesByMode[collection.defaultModeId];
    if (modeValue === undefined || modeValue === null) {
      return `{missing-mode:${variable.name}}`;
    }

    if (isAlias(modeValue)) {
      let targetId = modeValue.id;
      if (targetId.includes("/") && targetId.startsWith("VariableID:")) {
        const keyPart = targetId.substring("VariableID:".length, targetId.indexOf("/"));
        const referenced = keyByHash.get(keyPart);
        if (referenced) {
          targetId = referenced.id;
        } else {
          const localPath = figmaNameToPath(collection.name, variable.name);
          const fallback = UNRESOLVED_ALIAS_FALLBACKS[localPath.replace(/^primitives\./, "")];
          if (fallback) return fallback;
          return `{missing-alias:${variable.name}}`;
        }
      }

      const target = variableById.get(targetId);
      if (!target) {
        const localPath = figmaNameToPath(collection.name, variable.name);
        const fallback = UNRESOLVED_ALIAS_FALLBACKS[localPath.replace(/^primitives\./, "")];
        if (fallback) return fallback;
        return `{missing-alias:${variable.name}}`;
      }

      return `{${figmaNameToPath(
        collectionById.get(target.variableCollectionId)?.name ?? "primitives",
        target.name,
      )}}`;
    }

    const path = figmaNameToPath(collection.name, variable.name);
    return formatScalar(variable.resolvedType, modeValue, path);
  };

  const out = new Map<string, FlatFigmaToken>();

  for (const collection of exportData.collections) {
    for (const variable of collection.variables) {
      const path = figmaNameToPath(collection.name, variable.name);
      out.set(path, {
        path,
        collection: collection.name,
        type: variable.resolvedType,
        raw: resolveRaw(variable.id),
      });
    }
  }

  return out;
}
