# Design tokens

Two-layer token system aligned with the Figma **SMS** file export.

## Layers

| Layer | File | Who edits | Purpose |
|-------|------|-----------|---------|
| **Figma export** | `tokens.json` (repo root) | Design (re-export from Figma) | Full primitive scales — e.g. `spring green.10…66`, `grey.53…96` |
| **App extensions** | `tokens/extensions.json` | Engineering | Values not yet in Figma (extra spacing steps, radius, category colors) |
| **Generated primitives** | `tokens/primitives.json` | **Auto** — do not edit | Merged Figma + extensions, nested by category |
| **Semantic** | `tokens/semantic.json` | Engineering + design | UI roles → primitive refs (`background` → `{color.grey.96}`) |
| **Generated CSS** | `apps/web/app/design-tokens.css` | **Auto** — do not edit | `:root` custom properties consumed by the app |

## Workflow

After updating `tokens.json` from Figma:

```bash
npm run tokens:build
```

This will:

1. Regenerate `tokens/primitives.json` from `tokens.json` + `extensions.json`
2. Resolve `tokens/semantic.json` references
3. Write `apps/web/app/design-tokens.css`

To migrate hardcoded values in `globals.css` to token vars (after adding new semantic tokens):

```bash
npm run tokens:migrate-css
```

Restart the web dev server so Tailwind picks up any config changes.

### Adding a new semantic color

1. Pick the primitive scale step in `tokens/primitives.json` (after build) or reference path directly, e.g. `{color.spring-green.49}`
2. Add to `tokens/semantic.json` under `color`
3. Run `npm run tokens:build`

### Adding a value not in Figma yet

Add it to `tokens/extensions.json`, reference from `semantic.json`, then build.

Promote to `tokens.json` when design publishes the token in Figma.

## CSS variable naming

| Layer | Example path | CSS variable |
|-------|--------------|--------------|
| Primitive | `color.spring-green.10` | `--color-spring-green-10` |
| Semantic color | `background` | `--background` |
| Semantic spacing | `spacing.4` | `--space-4` |
| Layout | `layout.content-max` | `--layout-content-max` |
| Structure component | `component.structure.banner-radius` | `--structure-banner-radius` |

## Tailwind

`apps/web/tailwind.config.ts` maps semantic CSS variables to utility classes (`bg-background`, `p-4` → `var(--space-4)`, etc.). After adding new semantic tokens, extend the Tailwind config if you need utility classes.

## Typography presets

Composite typography from `semantic.json` → `typography.*` emits `--type-{style}-{property}` vars (e.g. `--type-eyebrow-font-size`).
