# Shared UI components & visual system

Reusable, presentation-only React components plus the spatial/type/color rules
they encode. Build pages from these instead of re-deriving the same markup +
CSS class combos per module. See also the `pds-spatial-design` skill for the
spacing rationale.

## Spatial scale — Material 4dp grid

The PDS spacing tokens are an 8dp system on a 4dp baseline grid (Material
Design's `spacing` factor). Every gap/padding maps to an existing
`--pds-*` token in `apps/web/app/design-tokens.css` (generated — never
hand-edit). Use the smallest step that still separates; step up only at a
relationship boundary.

| dp | Token | Use |
|---|---|---|
| 2 | `--pds-gap-xx-small` | label → its input; badge/chip y-padding |
| 4 | `--pds-gap-x-small` | control → helper/error; icon ↔ text; chip gap |
| 8 | `--pds-gap-small` / `--pds-padding-x-small` | field ↔ field; badge/chip x-padding |
| 12 | `--pds-gap-medium` / `--pds-padding-small` | sub-section grouping; input y-padding |
| 16 | `--pds-gap-large` / `--pds-padding-medium` | card sections; input x-padding |
| 20 | `--pds-padding-large` | card / panel padding |
| 24 | `--pds-gap-x-large` / `--pds-padding-x-large` | major region separation |
| 28 | `--pds-padding-xx-large` | dashboard content inset |

No new design tokens were required for the component work below — everything
reuses the tokens above. If a future component needs a value off this grid, add
it to the token source (`tokens/`), run `npm run tokens:build`, and document it
here.

## Typographic hierarchy

Adjacent levels must differ in size **and/or** weight. Tokens are
`--pds-type-<level>-*`; composite classes (`.pds-type-*`) are in
`design-tokens.css`.

| Level | Style | Token prefix |
|---|---|---|
| Page title | Title M Extrabold (22) | `title-m-extrabold` |
| Section `h2` | Title XS Bold (16) | `title-xs-bold` |
| Subsection `h3` | Title XXS Extrabold (14) | `title-xxs-extrabold` |
| Field label | Body S Semibold | `body-s-semibold` |
| Body | Body M Medium | `body-m-medium` |
| Meta / muted | Body S Regular | `body-s-regular` |
| Eyebrow / group label | Caption S/M (uppercase) | `caption-s` / `caption-m` |

## Color / emphasis

- **Lime (`--pds-compliment-brand`)**: primary CTA fill only (`.btn-primary`).
- **Status color**: expressed through badge **tones** (below), never ad-hoc hex.
- **Borders**: 1px `--pds-border-color-primary`; focus ring `0 0 0 3px var(--pds-states-focus)`.

## Components

### `Badge` / `StatusBadge` — `badge.tsx`

Canonical status pill. Replaces the ~25 copies of
`<span className="badge badge--{status}">`.

```tsx
<StatusBadge status={row.original.status} />            // tone inferred from status
<StatusBadge status={s} label={t(`status_${s}`)} />    // translated label
<Badge tone="success">Active</Badge>                   // explicit tone
```

Tones → CSS classes `.badge--tone-{neutral|success|info|warning|danger|brand}`.
`statusTone()` maps domain status strings to a tone; unknown statuses fall back
to `neutral` (never unstyled). Add new status→tone mappings in `STATUS_TONE`.

Sizing is fixed (`2px 8px`, Body S Semibold, pill). This fixed the prior bug
where `.badge` used `12px 8px` (vertical > horizontal), rendering tall ovals.
Legacy `.badge--active/.badge--invited/.badge--suspended/.badge--archived/.badge--pending`
aliases are retained for any non-migrated markup.

### `Chip` / `ChipGroup` — `chip.tsx`

Compact read-only tag for enumerating values inline (grade levels on a subject
row, categories, discount tags). Replaces divergent `.setup-grade-badge` /
inline tag styles. For a **selectable** pill use `OptionChip` instead.

```tsx
<ChipGroup>
  {grades.map((g) => <Chip key={g.id}>{g.name}</Chip>)}
</ChipGroup>
<Chip dotColor={subjectColor(name)}>{name}</Chip>   // optional leading dot
```

### `OptionChip` / `OptionChipGrid` — `option-chip.tsx`

Selectable pill with leading check indicator (fee components, payment plans).

### `StatCard` / `StatGrid` — `stat-card.tsx`

Single metric tile + responsive grid. Replaces the repeated
`.stat-card > .stat-label + .stat-value` markup (finance, admissions, dashboard,
academic-setup).

```tsx
<StatGrid>
  <StatCard accent icon={<Icon name="sell" size={18} />} label="Active types" value={6} />
  <StatCard label="Automatic" value={4} hint="auto-applied" />
</StatGrid>
```

`accent` gives the single headline metric the lime brand emphasis; use it at
most once per grid.

### `EmptyState` — `empty-state.tsx`

Consistent empty / first-run / error block (icon + title + description +
optional action). `TablePanelBody` renders a compact `EmptyState` automatically
for its empty/error cases; pass `emptyIcon` / `emptyTitle` / `emptyDescription` /
`emptyAction` to enrich it.

Wrap list tables in `DataTableSection` only on directory pages where the
table is a standalone card (Teachers, People tabs). Everywhere else, keep
`.panel` for the section shell; `DataTable` flattens inside `.panel-body` so
there is no double card.

```tsx
<EmptyState icon="sell" title={t("noRules")} action={<button className="btn-primary">…</button>} />
```

## Lime (brand) usage

Lime (`--pds-compliment-brand`) is the brand signal: primary CTA fill, toggle
ON state (lime track + ink thumb), and **sparing** accents (one `StatCard accent`,
a leading icon tint). Never on nav backgrounds, body text, or every card.

## When adding markup

1. Reach for a shared component before writing a new `<span className="...">`.
2. If three+ places repeat the same markup + classes, extract a component here
   and migrate the copies (this is how `Badge`/`Chip` came to be).
3. Keep new component CSS in `globals.css` under a labeled block, token-driven.
