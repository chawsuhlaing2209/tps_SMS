# Design tokens (PDS)

Single source of truth:

- **`tokens.json`** — Figma Variables export (primitives + semantic collections)
- **`composite_tokens.json`** — typography presets and composite styles

## Build

After updating exports from Figma:

```bash
npm run tokens:build
```

This writes:

- `apps/web/app/design-tokens.css` — `:root` custom properties (`--pds-*` only)
- `apps/web/app/design-tokens.dtcg.json` — grouped DTCG export for tooling

Restart the web dev server after building so Tailwind picks up config changes.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run tokens:build` | Regenerate CSS + DTCG from Figma exports |
| `npm run tokens:check` | Fail if any `var(--pds-*)` in app CSS is undefined |
| `npm run tokens:export-dtcg` | Regenerate DTCG JSON only |
| `npm run tokens:migrate-pds` | Codemod legacy `--*` vars → `--pds-*` in the web app |

## CSS variable naming

Figma slash paths are flattened to hyphenated names with the **`--pds-`** prefix. Redundant layer segments are collapsed:

| Figma path | CSS variable |
|------------|--------------|
| `color/spring-green/1000` | `--pds-color-spring-green-1000` |
| `padding/large` | `--pds-padding-large` |
| `pds-background/canvas` | `--pds-background-canvas` |
| `pds-text/primary` | `--pds-text-primary` |

Semantic tokens resolve to primitive `var(--pds-…)` references where possible.

## Composite typography

Typography presets from `composite_tokens.json` expose property vars and preset classes:

| Style | Example vars |
|-------|----------------|
| Title L extrabold | `--pds-type-title-l-extrabold-font-size`, `-font-weight`, `-line-height`, … |
| Body M medium | `--pds-type-body-m-medium-*` |
| Caption M | `--pds-type-caption-m-*` |

Use composite typography in app CSS — not primitive `--pds-font-size-*` / `--pds-font-weight-*` (those are excluded from the build).

## Usage in the app

- Import `design-tokens.css` once (via `globals.css`).
- Reference tokens as `var(--pds-…)` in CSS/modules — do not add legacy `--background`, `--space-4`, etc.
- Tailwind theme in `apps/web/tailwind.config.ts` maps utilities to PDS vars.

## Source files

| File | Role |
|------|------|
| `build.ts` | Build entry — CSS, DTCG, token check |
| `studio.ts` | Assembles `design-tokens.css` from Figma + composite maps |
| `figma-export.ts` | Parses `tokens.json` |
| `composite.ts` | Parses `composite_tokens.json` |
| `export-dtcg.ts` | CSS → DTCG JSON |
| `check-tokens.ts` | Validates `var(--pds-*)` references |
| `migrate-to-pds.ts` | Legacy var codemod (run once while migrating) |
