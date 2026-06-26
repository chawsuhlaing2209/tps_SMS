---
name: pds-spatial-design
description: >-
  Padauk Design System (PDS) spatial scale, typographic hierarchy, and aesthetic
  UI rules for the SMS web app. Use when styling or reviewing any dashboard page,
  panel, card, form, table, or component; when spacing/padding/gaps feel off,
  inconsistent, or "too tall"; when label-to-input distance, visual hierarchy,
  or color emphasis needs fixing; or before writing CSS in
  apps/web/app/globals.css or any *.module.css.
---

# PDS Spatial Design

Canonical spacing, hierarchy, and emphasis rules for the SMS web app. Every value
maps to a `--pds-*` token in `apps/web/app/design-tokens.css` (generated — never
hand-edit). Component CSS lives in `apps/web/app/globals.css`. Never hardcode px.

## Core principle: proximity encodes relationship

Spacing communicates grouping. Elements that belong together sit TIGHT; separate
regions get AIR. The most common mistake is uniform medium gaps everywhere — it
flattens hierarchy and reads as "too tall / too loose."

## Spatial scale (vertical rhythm)

Use the smallest gap that still separates. Step UP only when crossing a
relationship boundary.

| Relationship | Gap | Token |
|---|---|---|
| Label → its input/control (intra-field) | 2px | `--pds-gap-xx-small` |
| Control → helper/error text; inline icon↔text; chips | 4px | `--pds-gap-x-small` |
| Field → field in a group; toggle label → switch | 8px | `--pds-gap-small` |
| Sub-section grouping inside a card | 12px | `--pds-gap-medium` |
| Card internal sections; page sections; stat grid | 16px | `--pds-gap-large` |
| Major region separation (step sections, distinct blocks) | 24px | `--pds-gap-x-large` |

Rule of thumb: a label and its input are ONE unit → 2px. Do not use 8px+ between
a label and its field; that visually orphans the label.

## Padding scale

| Surface | Padding | Token(s) |
|---|---|---|
| Card / panel | 20px | `--pds-padding-large` |
| Compact card / stat card | 16px 20px | `--pds-padding-medium` `--pds-padding-large` |
| Input field | y 12px / x 16px | `--pds-input-padding-y` `--pds-input-padding-x` |
| Button | y 8px / x 16px | `--pds-button-padding-y` `--pds-button-padding-x` |
| Dashboard content | 24–28px | `--pds-padding-xx-large` |

## Radius scale

| Element | Radius | Token |
|---|---|---|
| Input / control / inner tile | 8px | `--pds-border-radius-8` |
| Card / panel | 24px | `--pds-radius-24` |
| Button / badge / toggle / chip | pill | `--pds-radius-pill` / `--pds-border-radius-pill` |

## Typographic hierarchy

Each level must be visibly distinct. Never render two adjacent levels at the same
size+weight.

| Level | Style | Token prefix |
|---|---|---|
| Page title (top bar) | Title M Extrabold (22) | `--pds-type-title-m-extrabold-*` |
| Section / panel `h2` | Title XS Bold (16) | `--pds-type-title-xs-bold-*` |
| Subsection `h3` | Title XXS Extrabold (14) | `--pds-type-title-xxs-extrabold-*` |
| Field label | Body S Semibold, `--pds-text-secondary` | `--pds-type-body-s-semibold-*` |
| Caps/eyebrow label | Caption S (uppercase) | `--pds-type-caption-s-*` |
| Body text | Body M Medium | `--pds-type-body-m-medium-*` |
| Meta / muted / helper | Body S Regular, `--pds-muted` | `--pds-type-body-s-regular-*` |
| Group label (uppercase) | Caption M | `--pds-type-caption-m-*` |

## Color & emphasis rules

Restraint creates hierarchy. One strong focal point per region.

- **Lime / compliment-brand (`--pds-compliment-brand`)**: the brand signal.
  Use for: the PRIMARY CTA fill (`.btn-primary`), the toggle ON state, and
  sparing emphasis accents (e.g. one headline `StatCard accent`, a leading
  icon tint). Still NOT for nav backgrounds, body text, or blanket decoration —
  keep it to one or two focal points per region so it stays meaningful.
- **Toggles (on state)**: lime track (`--pds-compliment-brand`) with an ink
  thumb (`--pds-primary`) for contrast. Off: `--pds-border-color-secondary`
  with white thumb. Size 44×24, thumb 20.
- **Sidebar active item**: subtle `--pds-shell-raise` background + 3px
  lime inset bar + accent icon. Not a full lime pill.
- **Tabs / subnav active**: ink underline (`--pds-primary`) + primary text.
- **Borders**: 1px `--pds-border-color-primary`. Focus ring: `0 0 0 3px
  var(--pds-states-focus)`.
- **Text**: primary `--pds-text-primary`, secondary `--pds-text-secondary`,
  muted `--pds-muted`. Body text on cards must meet WCAG AA (≥4.5:1).

## Accessibility checklist

- [ ] Interactive targets ≥ 36px tall (buttons) / 24px (toggles) with adequate hit area
- [ ] Visible focus ring on all focusable controls (`--pds-states-focus`)
- [ ] Color is never the only signal (pair with icon/label/badge text)
- [ ] Label associated with control (`htmlFor`/`aria-label`)
- [ ] Text contrast AA; muted text only for non-essential meta

## Ideal page composition

`.page-stack` (16px gap) → optional `DetailHero` → `.panel` sections (20px
padding, 16px internal gap). Inside a panel: `PanelHead` (title only, no
description) → content. Forms use tight label↔input (2px), 8px field↔field.

## Anti-patterns

- ❌ 8px+ between a label and its input → use 2px
- ❌ Description/help paragraphs under page titles and section titles → remove
- ❌ Uniform 24–28px gaps between every element → reserve for major regions only
- ❌ Lime on nav backgrounds, body text, or every card → keep to CTA, toggle
  ON, and one or two intentional accents per region
- ❌ Hardcoded px or hex in component CSS → use `--pds-*` tokens
- ❌ Two heading levels at identical size/weight

## Workflow when fixing a screen

1. Identify regions (page → cards → groups → fields). Assign each boundary a gap
   from the scale (tight inside, air between).
2. Set type levels so no two adjacent elements share size+weight.
3. Ensure exactly one primary CTA focal point; demote the rest to ghost/outlined.
4. Replace any hardcoded value with the matching `--pds-*` token.
5. Run `npm run typecheck -w @sms/web` and `ReadLints` on edited CSS.
