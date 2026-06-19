# PDS Component Library

Padauk Design System (PDS) UI is organized using the **subcomponent** model ([EightShapes](https://medium.com/eightshapes-llc/subcomponents-753ce9f6600a)): small, reusable interactive pieces compose into larger patterns without duplicating CSS classes.

## Figma source

| Component | Figma node | Code |
|---|---|---|
| Radio Box | [35:14634](https://www.figma.com/design/ijAgEelM6OgifzPI0R5BoQ/Pujuba?node-id=35-14634) | `components/pds/subcomponents/radio-box.tsx` |
| Checkbox | [35:14933](https://www.figma.com/design/ijAgEelM6OgifzPI0R5BoQ/Pujuba?node-id=35-14933) | `components/pds/subcomponents/check-box.tsx` |
| Button | [2:95](https://www.figma.com/design/ijAgEelM6OgifzPI0R5BoQ/Pujuba?node-id=2-95) | `components/ui/button.tsx` |
| Divider | [35:14443](https://www.figma.com/design/ijAgEelM6OgifzPI0R5BoQ/Pujuba?node-id=35-14443) | `components/pds/subcomponents/divider.tsx` |
| option-items/default | [35:13664](https://www.figma.com/design/ijAgEelM6OgifzPI0R5BoQ/Pujuba?node-id=35-13664) | `components/pds/composites/option-item.tsx` |
| option-items/radio | [35:13688](https://www.figma.com/design/ijAgEelM6OgifzPI0R5BoQ/Pujuba?node-id=35-13688) | `components/pds/composites/option-item.tsx` |
| option-items/checkbox | [35:13709](https://www.figma.com/design/ijAgEelM6OgifzPI0R5BoQ/Pujuba?node-id=35-13709) | `components/pds/composites/option-item.tsx` |
| Options | [35:13598](https://www.figma.com/design/ijAgEelM6OgifzPI0R5BoQ/Pujuba?node-id=35-13598) | `components/pds/composites/options.tsx` |
| Select_Item/position | [35:12288](https://www.figma.com/design/ijAgEelM6OgifzPI0R5BoQ/Pujuba?node-id=35-12288) | `components/pds/composites/select-item-position.tsx` |
| Select | [35:12158](https://www.figma.com/design/ijAgEelM6OgifzPI0R5BoQ/Pujuba?node-id=35-12158) | `components/pds/composites/select.tsx` |

Machine-readable registry: `apps/web/components/pds/registry.ts`.

## Layer model (subcomponents vs assemblies)

Components are **peers at their layer**, not exclusive children of Select. `PdsSelect` is one consumer that wires them together.

```text
Subcomponents (atoms — use anywhere)
├── RadioBox
├── CheckBox
├── Divider
└── Button

Composites (reusable patterns — use anywhere)
├── OptionItem (default | radio | checkbox)
│   └── composes: Divider, RadioBox, or CheckBox
├── Options (scrollable list + optional footer)
│   └── composes: OptionItem[], Button (Clear / Okay)
└── SelectItemPosition (top | bottom panel shell)
    └── slot: any children (Options is a common default)

Feature assembly (one product pattern)
└── PdsSelect
    ├── trigger
    └── SelectItemPosition → Options (default wiring)
```

### Where each layer is used

| Component | Standalone examples |
|---|---|
| **Button** | Forms, tables, heroes, Options footer, confirm dialogs |
| **Options** | Filter popover, multi-select sheet, command palette body |
| **OptionItem** | Custom lists, segmented pickers, menu rows |
| **SelectItemPosition** | Any anchored dropdown panel (not only select trigger) |
| **PdsSelect** | Form fields, filter chips — when you need the full Figma select |

**Rule:** build order follows dependency (atoms → composites → assemblies), but **runtime usage does not require nesting under Select**.

## Composition example (PdsSelect — optional assembly)

```tsx
import { PdsSelect } from "@/components/pds";

<PdsSelect items={grades} optionVariant="radio" hasFooter />
```

## Composition example (Options alone)

```tsx
import { Options, Button } from "@/components/pds";

<Options
  items={filters}
  variant="checkbox"
  hasFooter
  onItemSelect={toggleFilter}
  onClear={clearAll}
  onOkay={apply}
/>
```

## Subcomponent rules

1. **Never restyle atoms inside composites** — composites only arrange subcomponents and pass props.
2. **Tokens only** — all visual values come from `--pds-*` variables in `design-tokens.css`; component CSS lives in `globals.css` under `.pds-*` classes.
3. **Figma parity** — each component exposes the same variant props as the Figma component set (`isSelected`, `hasDivider`, `buttonType`, etc.).
4. **Import path** — `import { Options, Button, PdsSelect } from "@/components/pds"` (Button re-exported from the PDS barrel).
5. **Material Symbols glyphs** — always use native MS ligatures via `<Icon />` (see `DESIGN.md` §7). CheckBox/RadioBox map states to `check_box` / `radio_button_checked` etc.; never duplicate those shapes in CSS.

## Icon usage (required)

```tsx
// Checkbox states
<Icon name="check_box_outline_blank" size={24} />
<Icon name="check_box" filled size={24} />
<Icon name="indeterminate_check_box" filled size={24} />

// Radio states
<Icon name="radio_button_unchecked" size={24} />
<Icon name="radio_button_checked" filled size={24} />
```

Wrapper classes set **layout and color only** (`pds-check-box__indicator--checked { color: … }`).
Do not attach sizing or glyph-specific classes to `.ms` unless a parent context must override color.

## Styling

| Layer | Location |
|---|---|
| Tokens | `apps/web/app/design-tokens.css` (generated) |
| Component CSS | `apps/web/app/globals.css` (`.pds-*` blocks) |
| PDS React | `apps/web/components/pds/**` |
| App composites | `apps/web/components/shared/**` |
| Radix primitives | `apps/web/components/ui/**` |
| Toast host + UI | `components/shared/app-toaster.tsx`, `app-toast.tsx` |

## Storybook

```bash
npm run storybook -w @sms/web
```

| Folder | Contents |
|---|---|
| `stories/pds/` | Figma-aligned PDS components (Select, CheckBox, Button, …) |
| `stories/shared/` | Padauk composites (`Badge`, `FormInput`, `Stepper`, `AppToast`, …) |
| `stories/ui/` | Radix/shadcn shells (`Dialog`, `Sheet`, `Table`, `Tabs`, …) |
| `stories/legacy/` | Removed — superseded primitives documented under PDS/Shared |

## Tests

```bash
npm run test -w @sms/web
```

Vitest + Testing Library cover interaction (toggle, select, option click) and variant class mapping. Visual token checks use `components/pds/test-utils.ts`.

## Migration notes

- `components/ui/select.tsx` (Radix) was **removed** — use `PdsSelect` / `PdsSelectField` for all selects.
- `FormSelect` in `components/shared/form-input.tsx` now wraps `PdsSelectField` (options prop, not native `<option>` children).
- `CheckboxList` lives in `components/pds/composites/checkbox-list.tsx`; `components/shared/checkbox-list.tsx` re-exports it.
- `StudentCombobox` / `GuardianCombobox` use searchable `PdsSelect` with `onSearchChange` for async API results.
- `AppToaster` (Sonner host) lives in `components/shared/app-toaster.tsx` next to `app-toast.tsx`; mount once from `app/layout.tsx`.
- `Modal` (`components/pds/composites/modal.tsx`) is the canonical centered dialog; `ConfirmDialog` / `AppModal` in `shared/confirm-dialog.tsx` are presets. `components/ui/dialog.tsx` re-exports Modal for backward compatibility.
- `components/ui/badge.tsx` and `components/ui/switch.tsx` were **removed** — use `shared/badge` and `shared/toggle`.
- `Button` now supports Figma `ghost` type and `secondary` outlined on light surfaces.
