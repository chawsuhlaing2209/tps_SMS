# Padauk School OS — Design Language

A school-administration product for Myanmar schools (fees in MMK, grades KG–G12). The
aesthetic is **calm, dense, and editorial**: a deep-forest brand, one electric lime accent,
generous white cards on a pale-sage canvas, and a confident display typeface for anything
that carries a number or a title. It should feel like a serious operations tool — closer to
a well-run ledger than a consumer app — never playful, never gradient-heavy.

This document is the source of truth for every screen in this project. Match it exactly;
don't invent new colors, fonts, radii, or component patterns.

---

## 1. Color

### Core palette
| Token | Hex | Use |
|---|---|---|
| **Forest (brand)** | `#0a2a1d` | Sidebar, dark hero cards, primary buttons, headings, body text, active chips |
| **Lime (accent)** | `#c6f24e` | THE primary CTA, active nav item, highlight numbers on dark, toggle "on" track |
| **Canvas** | `#f4f7f1` | App background behind all content (pale sage) |
| **Surface** | `#ffffff` | Cards, inputs, panels, default chips |
| **Forest-700** | `#11392a` | Raised blocks *inside* the dark sidebar / dark cards (badge, profile, nested panels) |
| **Forest-600** | `#1c4a36` | Radial-glow accent inside dark hero cards only |

### Borders & dividers (warm sage greys, never pure grey)
- `#e3ebdf` — default control & card border (the workhorse)
- `#e6ede3` — softer card border
- `#eef3ea` / `#f0f4ed` — hairline dividers inside cards
- `#1a3a2b` / `#25503c` — borders on dark (sidebar edge, dark-card inner)

### Text greys (all sage-tinted)
- `#0a2a1d` — primary text / headings
- `#41594b` — strong body / control labels
- `#7c917f` — secondary text, descriptions, breadcrumbs ("sage")
- `#9fb3a6` — muted / placeholder / captions / muted-on-dark
- `#5f7a6b` — uppercase eyebrow labels
- `#7f9a8b`, `#6f8a7b` — muted text on dark backgrounds

### Semantic / status (always a tinted bg + a saturated text color)
| Meaning | Background | Text |
|---|---|---|
| Success / Paid / Present | `#e7f6d8` (or `#eef7e4`) | `#3a7d24` |
| Warning / Partial / Late | `#fdeccf` | `#a9711a` |
| Danger / Overdue / Absent | `#fde0db` | `#c0392b` |
| Info | `#e7eefe` | `#2f6cad` |
| Special / Scholarship | `#f3eafe` | `#7a4fd0` |
| Action link (inline) | — | `#2f7d4e` |

### Categorical (subjects & data viz)
Maths `#3b6ff5` · English `#ff6b57` · Physics `#8b6cf0` · Chemistry `#f56fa1` ·
Biology/Science `#33b06a` · Myanmar `#2bc4b0` · Social Science `#f5b73d` · Sky `#5b8def`.
Grade chips: A→success, B→info, C→warning, D→danger.

Use these **only** for categorical encoding (a subject, a chart series). Never as decoration.

---

## 2. Typography

Two families, loaded from Google Fonts. No others.

- **Bricolage Grotesque** (`800`, `letter-spacing:-0.02em`) — display face. Page titles (`h1`,
  ~25px), card headings, **every prominent number** (stats, prices, percentages, totals,
  grades), brand wordmark. This is what gives the product its character — reach for it whenever
  a value should feel typeset.
- **Hanken Grotesk** (`400`–`800`) — all UI text: labels, body, descriptions, buttons, inputs,
  table cells.
- **Material Symbols Rounded** — every icon, via `.ms` (outline) / `.ms.fill` (filled).
  Weight 500, optical size 24. **Icons only — never emoji.**

### Type roles
- **Eyebrow label**: 10–11px, weight 700, `letter-spacing:0.04–0.13em`, UPPERCASE, color
  `#5f7a6b`/`#7c917f`. Used above sections and on stat cards.
- **Page title**: Bricolage 800, ~25px, `#0a2a1d`, `letter-spacing:-0.02em`, `line-height:1`.
- **Card title**: Bricolage 800, 17–20px.
- **Body**: Hanken, 13–14px, `line-height:1.45–1.5`, `#41594b`/`#7c917f`.
- **Big number**: Bricolage 800, 19–30px, `line-height:1`.

Minimum readable size is 10px and it is reserved for uppercase eyebrows only; default UI text
is 12–14px.

---

## 3. Shape, depth & spacing

- **Radii** (rounded but not bubbly): icon tiles `10–12px` · inputs / small chips `9–13px` ·
  cards `14–18px` · hero & feature cards `20–24px` · status pills & toggles `999px`.
- **Borders over shadows.** Structure comes from `1px`/`1.5px` sage borders, not drop shadows.
  Shadows appear only on: hover lift (`0 6px 22px rgba(10,42,29,0.07)`), floating toast
  (`0 8px 32px rgba(10,42,29,0.35)`), and the mobile drawer. The forest tint inside every
  shadow matters — never `rgba(0,0,0,…)`.
- **Inputs**: white, `1.5px solid #e3ebdf`, radius 12px, `11px 14px` padding; focus →
  `border-color:#0a2a1d` (no glow, no ring).
- **Icon tile**: square, rounded, a tinted bg (`#e7eefe`, `#fdeccf`, etc.) + matching filled
  icon — the standard way to give a list row or card identity.
- **Spacing**: card padding 14–20px; grid/flex `gap` 8–16px; section rhythm ~22px. Always lay
  rows out with flex/grid + `gap`, never margins between inline siblings.

---

## 4. Components (the established vocabulary)

- **Sidebar**: 236px, forest bg, `MANAGE` / `SYSTEM` label groups, `.pk-nav` items (muted →
  hover `#11392a` → active = lime bg + forest text + bold). Profile chip pinned to bottom on a
  `#11392a` block. On mobile it collapses to a forest top bar + slide-out drawer.
- **Header**: breadcrumb (sage, `chevron_right` separators) above an `h1`; primary action on the
  right.
- **Buttons**: primary = forest bg / white text **or** lime bg / forest text; secondary = white /
  `#e3ebdf` border / `#41594b`. Radius 12–13px, weight 700, often with a leading `.ms` icon.
- **Toggle**: 42–44×24–26px track, lime when on / `#e3ebdf` when off, white knob.
- **Tabs / segmented / day-pickers / chips**: white + border at rest; selected = forest fill +
  white text (or lime fill for emphasis filters). Counts ride along in a small pill that flips
  to lime-on-forest when active.
- **Selectable chip**: shows a `check_circle` (filled, success) when on and tints its bg/border
  green; an empty `circle` (`#c3d0c9`) when off.
- **Stat card**: white, eyebrow + filled icon, big Bricolage number, sage sub-line.
- **Dark feature card**: forest bg, lime eyebrow pill, white heading, sage body, optional
  radial `#1c4a36` glow top-right. Used for hero greetings and "global rules" callouts.
- **Stepper** (wizards): numbered dots — current = forest dot/lime numeral, done = lime dot +
  `check`, future = white/`#e3ebdf`; lime connector lines once passed.
- **Toast**: fixed bottom-right, forest bg, white text, lime `check_circle`.

---

## 5. Motion

One signature entrance: `@keyframes pkUp` — `translateY(8px) → 0` over `.28–.4s
cubic-bezier(.2,.7,.3,1)`, applied via `.pk-anim` on view/step change. Transitions on
interactive states are short (`.12–.18s`) and limited to `border-color`, `background`,
`box-shadow`, `filter`. Nothing bounces, spins, or pulses.

---

## 6. Voice & content

- Concrete and operational: "3 approvals waiting", "Net payable", "first match wins".
- Myanmar context is real: MMK currency (format numbers with thousands separators, set in
  Bricolage), names like *U Kyaw Min*, *Ma Hnin Ei*, grades KG–G12, terms.
- Sentence case for body and buttons; UPPERCASE only for eyebrow labels.
- No filler — every stat, chip, and row earns its place. Don't pad screens to look busy.

---

## 7. Anti-patterns — do NOT

**General slop**
- ❌ Gradient backgrounds/buttons. The only gradient allowed is the faint radial forest glow
  inside a dark hero card. Everything else is flat.
- ❌ Emoji as icons. Use Material Symbols Rounded.
- ❌ **Re-drawing Material Symbols in CSS** — no faux checkbox squares, radio rings, inner dots,
  SVG checkmarks, or per-icon utility classes (`pds-check-box__icon`, `pds-btn__icon`, etc.)
  when a native glyph exists. Use `<Icon name="…" />` with the official ligature
  (`check_box`, `check_box_outline_blank`, `radio_button_checked`, `radio_button_unchecked`,
  `indeterminate_check_box`, …). Size via the `size` prop; color via `color` on the wrapper
  (`.pds-check-box__indicator--checked`, `.pds-radio-box__indicator--checked`). The font
  includes optical padding — do not add extra inset boxes around glyphs.
- ❌ Inter, Roboto, Arial, system-ui, or any font outside Bricolage + Hanken.
- ❌ The "rounded box with a colored left-border accent stripe" cliché.
- ❌ Heavy/black drop shadows, neumorphism, glassmorphism, glow rings on focus.
- ❌ Decorative stat/number/icon clutter ("data slop"). Less, but real.

**Project-specific**
- ❌ Pure greys (`#888`, `#ccc`, `#000`). Greys here are sage-tinted (`#e3ebdf`, `#7c917f`…),
  and shadows are forest-tinted `rgba(10,42,29,…)`.
- ❌ **Lime text on white/light.** `#c6f24e` fails contrast on light surfaces — use it as a
  *fill* behind forest text, or as text only on the forest background. For green text on light,
  use `#2f7d4e`/`#3a7d24`.
- ❌ More than **one** lime primary action per view. Lime is the loudest thing on screen; two
  of them cancel out. Secondary actions are white-with-border or forest.
- ❌ New accent hues. Stay within the core + semantic + categorical palettes above; if you need
  a related shade, derive it in `oklch` from an existing token rather than inventing a hex.
- ❌ Using semantic colors decoratively (a green pill that doesn't mean success, a red that
  isn't danger). Status color = status meaning.
- ❌ Using subject/categorical colors for anything that isn't categorical encoding.
- ❌ Body text below 12px, or display numbers set in Hanken instead of Bricolage.
- ❌ Spacing rows with source-whitespace inline siblings or per-element margins — use flex/grid
  `gap`.

---

## 8. Quick reference

```
brand   #0a2a1d   accent #c6f24e   canvas #f4f7f1   surface #fff
raised  #11392a   border #e3ebdf   divider #eef3ea
text    #0a2a1d / #41594b / #7c917f / #9fb3a6   eyebrow #5f7a6b
ok #3a7d24 on #e7f6d8 · warn #a9711a on #fdeccf · danger #c0392b on #fde0db
info #2f6cad on #e7eefe · link #2f7d4e
display: Bricolage Grotesque 800 (-0.02em)   ui: Hanken Grotesk 400–800   icons: Material Symbols Rounded
radii 10/12/16/24/999 · borders not shadows · entrance pkUp .3s
```
---

## Layout

### Shell

```
┌─────────────────────────────────────────────────────────────┐
│ Sidebar  │  Utility header — breadcrumb      AY · bell      │
│ 236px    ├──────────────────────────────────────────────────┤
│          │  Page title (+ optional actions)                 │
│          │  ─────────────────────────────────────────────  │
│          │  Page body (max 1180px, left-aligned)            │
│          │  padding: 20px 30px 28px                          │
└──────────┴──────────────────────────────────────────────────┘
```

- **Grid:** `.dash` — sidebar + main column
- **Sidebar:** `.dash-sidebar` — `--shell` background, sticky full height, grouped nav, user card pinned bottom
- **Utility header:** `.dash-page-chrome` — in-body bar (not the old top nav); `PdsBreadcrumb` left, working-year badge + notifications right
- **Title row:** `.dash-page-title` — page `h1` from `PageHeader` context; optional `actions` slot (primary/secondary CTAs)
- **Content:** `.dash-content-body` — gutter tokens; sections capped at `--layout-content-max`, **left-aligned**
- **Between page sections:** `--layout-section-gap` (20px) via `.page-stack`

### Page structure

```
DashboardPageChrome (layout — breadcrumb + utilities)
.dash-content-body
  DashboardPageTitle (layout — reads PageHeader context)
  {page children}
    PageHeader (publishes title, breadcrumbs, actions — renders null)
    .page-stack
      DetailCard / DetailHero (optional — detail pages)
      .subnav (optional — module tabs, e.g. Finance invoices/collection)
      .panel (section 1)
      …
```

- Titles and breadcrumbs live in the **body chrome**, not a separate top navigation bar.
- Pages publish metadata via `PageHeader`; the layout renders breadcrumb + title rows automatically.
- Empty/error/loading states belong in `.panel-body` or `TablePanelBody` — not floating between grid rows.
- Module layouts (Finance, Salary, Exams) wrap children in `.module-shell` + optional `.subnav` inside page content.

### Sidebar navigation

Permission-filtered groups from `apps/web/app/lib/permissions.ts`. Active item: lime `--brand` background, ink text, filled Material icon.

```
[Logo — tenant slug]

  SCHOOL
  ▸ Overview
  ▸ People

  ACADEMICS
  ▸ Structure
  ▸ Academic Setup
  ▸ Calendar
  ▸ Timetable
  ▸ Exams

  BUSINESS
  ▸ Admissions
  ▸ Enrollments
  ▸ Finance
  ▸ Salary

  ADMIN
  ▸ Communication
  ▸ Audit Log

  [User card — sign out menu]
```

Finance sub-routes use horizontal `.subnav` (Billing, Fee Items, Enrollment Fee Plans, Invoices, Payments, Discounts, Reports) — not duplicated in the sidebar.

---

## Component Library

Implementation split:

| Kind | Location | When to use |
|------|----------|-------------|
| Padauk CSS classes | `globals.css` | Shell, panels, tables, buttons, structure pages |
| App lib components | `apps/web/app/lib/` | Reusable React wrappers (`Panel`, `DataTable`, …) |
| shadcn/ui | `apps/web/components/ui/` | Dialog, Sheet, Button (secondary to Padauk buttons) |
| Shared | `apps/web/components/shared/` | `ConfirmDialog`, `AppToast`, `CheckboxList` |

### Page header (`PageHeader` + in-body chrome)

Pages publish metadata via `PageHeader` from `apps/web/app/dashboard/page-header-context.tsx`. The layout renders:

1. **`DashboardPageChrome`** — `PdsBreadcrumb` + academic year + notifications
2. **`DashboardPageTitle`** — page title and optional trailing actions

```tsx
<PageHeader
  title={t("title")}
  breadcrumbs={[
    { label: t("group_school"), href: "/dashboard" },
    { label: t("teachers"), href: "/dashboard/teachers" },
    { label: teacher.fullName },
  ]}
  actions={<button className="btn-primary">…</button>}
/>
```

Use `PdsBreadcrumb` directly only in Storybook or special cases; dashboard pages should prefer `PageHeader`.

Unmigrated routes get a sensible fallback from the nav config.

### Panels

```tsx
import { Panel, PanelHead } from "@/app/lib/panel";

<Panel>
  <PanelHead title="Students" help="Active enrollments this year" actions={<button className="btn-primary">…</button>} />
  <div className="panel-body">…</div>
</Panel>
```

For tables, prefer `TablePanelHead` + `TablePanelBody` (`apps/web/app/lib/table-panel.tsx`) — handles loading / error / empty with i18n defaults.

### Detail hero

Dark ink-green banner for record detail pages (`DetailHero` in `apps/web/app/lib/detail-hero.tsx`):

- Colored squircle mark (initials or Material icon)
- Title + meta line
- Primary actions: `.btn-hero-primary` (lime) + `.btn-hero-outline` (ghost on dark)
- Utility icon buttons: `.detail-hero__icon-btn`

Structure/academic pages use related patterns: `.structure-year-banner`, `.structure-room-banner` (gradient shell).

### Data tables

`DataTable` (`apps/web/app/lib/data-table.tsx`) wraps TanStack Table + shadcn `Table`, which applies `.padauk-table-wrap` / `.padauk-table`.

```
[TableSearchInput]  [filters in .table-toolbar]     [btn-primary Add]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Name            Admission#   Grade   Balance    Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Mg Aung Zaw     A-2024-001   G10A    15,000 ks  ● active
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Showing 1–50 of 342              [← Prev]  Page 1 of 7  [Next →]
```

- Header: 11px uppercase, 800 weight, `--surface` background, muted color
- Cells: 14px, padding 14×16px (`--space-3_5` × `--space-4`)
- Hover: `--subtle` row highlight
- Sortable columns: `.table-sort` button in header
- Clickable rows: `getRowHref` or `onRowClick`; Enter/Space activates; skips nested buttons/links
- Default sort: active statuses first, then `updatedAt` desc (when column present)
- Toolbar search: `TableSearchInput` (rounded rect, matches `.dash-search` — single border, no pill wrapper)
- Pagination: `PaginationControls` in `.pagination` footer

**Row navigation (required when a detail route exists):**

- Pass `getRowHref` or `onRowClick` on `DataTable` so the **entire row** opens the record (cursor pointer + hover on all cells).
- Do **not** put the only navigation affordance in the first column via a nested `<Link>`. That trains users to click one cell and breaks row-wide interaction.
- Use `DirectoryNameCell` for the name column when rows navigate — same avatar/title styling without a nested link.
- Nested links/buttons inside a row (e.g. household link, invoice link, row actions) must use `data-row-stop` or native interactive elements so they do not trigger row navigation.

**View-only tables** (no detail page): omit `getRowHref` / `onRowClick`; rows still get default hover highlight via `.padauk-table tbody tr:hover`.

### Record list

Vertical list of squircle rows (`RecordList` / `RecordListItem` in `apps/web/app/lib/record-list.tsx`):

- Row radius `--radius-md`, gap `--record-list-gap`, padding `--record-list-item-padding`
- Icon 40×40 with category color; title 14px/700; meta 12px muted
- Optional trailing action label or badge

### Person / roster cards

`.person-card` / `PersonCard` pattern — compact horizontal card with avatar squircle, name, meta. Used in roster grids (`.record-card-grid`).

### Stat cards

`.stat-card` in a `.stat-grid` — white card, `--radius-card` (20px), label 13px muted, value 30px/700. Used on overview/dashboard summaries. Structure pages use `.structure-stat` (dark inset chips on year banner).

### Status badges

**In tables (primary pattern):** pill badges with muted semantic backgrounds:

```html
<span class="badge badge--active">active</span>
<span class="badge badge--pending">pending</span>
```

Variants in `globals.css`: `--active`, `--invited`, `--pending`, `--suspended`, `--archived`.

**Optional dot badge:** `StatusBadge` in `components/ui/badge.tsx` — compact `● Label` for inline prose (Tailwind color tokens).

Always capitalize/status-label via i18n in UI; never hardcode English status strings in JSX.

### Buttons

Prefer Padauk CSS buttons for dashboard consistency:

| Class | Use |
|-------|-----|
| `.btn-primary` | Lime filled CTA |
| `.btn-ghost` | White bordered pill (refresh, secondary) |
| `.btn-outline` | Neutral outline |
| `.btn-hero-primary` / `.btn-hero-outline` | Actions on dark heroes |
| `.row-action` | Compact table row actions |

shadcn `Button` is used inside `ConfirmDialog` and some newer primitives. Match Padauk sizing when mixing.

Auth pages: `.auth-button`, `.auth-button--ghost`.

### Forms

- **Field layout:** `.form-field` + `.form-stack` (14px gap)
- **Entity create/edit (inline):** `.entity-form` — subtle background grid
- **Sheet forms:** `RecordFormSheet` → shadcn `Sheet` (480px max-width, slides from right) + `.entity-form--sheet` + `.form-stack`
- **Validation:** `.field-error` below inputs; `.form-feedback--ok` for success
- **Focus:** `--focus-ring` box-shadow on inputs

Use `react-hook-form` + shared Zod schemas; all labels/messages via `next-intl`.

### Confirm dialog

`ConfirmDialog` (`components/shared/confirm-dialog.tsx`) — centered shadcn Dialog. Safe action left (outline), destructive confirm right (`variant="destructive"`). Title states the action; description states consequences.

### Toasts

Sonner with custom `AppToast` (`components/shared/app-toast.tsx`):

- Position: bottom
- Pill shape, `--shell` background, white text
- Success: lime icon squircle; error: coral icon squircle
- Dismiss button on the right

Use `apps/web/app/lib/toast.ts` helpers — do not raw-call Sonner with default styling.

### Empty states

No standalone `EmptyState` component. Patterns:

- `TablePanelBody` with `empty` → muted paragraph in `.panel-body`
- `.structure-empty` — dashed border panel with CTA
- Domain-specific copy + primary button inside the owning panel

### Structure / academic setup

Structure pages (`/dashboard/structure`, academic setup) use additional tokens (`--structure-*`) and classes:

- `.structure-grade-chip` — horizontal grade rail
- `.structure-segment-tab` — pill tabs (Classrooms / Gradebook / …)
- `.structure-room-card` — room grid cards with subject tags
- `.setup-*` — academic setup subjects/grades/classrooms layouts

Reuse these patterns when extending school-structure UI — do not introduce a third card style.

### Working year badge

`.working-year-badge` in the page utility header — links to academic year setup; warning variant when no active year.

---

## Interaction Patterns

### Loading states

- List/table panels: muted loading text via `TablePanelBody` (no skeleton library yet)
- Buttons: disabled + label change (`Please wait…`) on submit
- Full-page: `.dash-loading` centered muted text
- Background jobs: toast with progress message when applicable

### Error states

- Field: `.field-error` (13px, `--status-danger-fg`)
- Form: `.auth-error` banner or `.form-feedback`
- Panel: `.error-text` in `.panel-body`
- Network: toast error variant

### Optimistic updates

Apply changes to UI immediately, revert on error where safe (payments, attendance). Prefer subtle button loading over full-page spinners.

---

## Finance UI Conventions

- All monetary values: `MMK {:,.0f}` format (e.g. `MMK 150,000`)
- Overdue amounts: danger color + pending/overdue badge
- Partial payments: warning badge with remaining balance
- Invoice numbers: monospace, uppercase (`INV-2024-0042`)
- Receipt numbers: monospace (`RCP-2024-0018`)
- Enrollment fees: unified enrollment ceremony — Finance is for AR/recurring ops, not re-entering enrollment fees (see `docs/unified-enrollment-billing-plan.md`)

---

## Burmese (Myanmar) Language Support

- All i18n strings via `next-intl` — never hardcode in JSX
- Add keys to both `messages/en.json` and `messages/my.json`
- Date format: Gregorian with locale-appropriate month names
- Number formatting: standard numerals for finance (not Burmese numerals)
- RTL: not required (Myanmar is LTR)
- Test layouts with Burmese strings (30–50% longer than English)

---

## Accessibility

- WCAG AA contrast on text (especially `--muted` on `--background`)
- Focus: `--focus-ring` / `focus-visible:ring-2 focus-visible:ring-brand` on interactive elements
- Icon-only buttons: `aria-label` via i18n
- Tables: clickable rows use `role="link"` + keyboard Enter/Space
- Toasts: `role="status"` + `aria-live="polite"`
- Errors: `role="alert"` where appropriate
- Modals/sheets: Radix focus trap (shadcn)

---

## Do / Don't

**Do:**
- Use design tokens (`var(--*)`) or Tailwind classes mapped in `tailwind.config.ts`
- Use 1px borders to define everyday surfaces
- Use the frame pattern (`.panel` + `PanelHead` + `.panel-body`) for sections
- Use color purposefully — status, categories, CTAs; not decoration on neutral cards
- Keep table rows compact; right-align numeric columns
- Use monospace for IDs, codes, invoice numbers
- Put page titles in the body title row via `PageHeader` (not inside panels or a separate top nav)
- Use `DetailHero` on record detail pages
- Use `TableSearchInput` in panel toolbars instead of raw search inputs

**Don't:**
- Hardcode hex/rgb in component files
- Hand-roll panel markup when `Panel` / `TablePanelHead` exist
- Center page content (`margin: 0 auto` on dashboard pages — content is left-aligned)
- Use full-page modals for create/edit flows that fit in a sheet
- Add floating `.panel-help` paragraphs — pass `help` to `PanelHead` / `TablePanelHead`
- Stretch panels in multi-column grids without `align-self: start`
- Introduce one-off typography sizes outside the `--type-*` / established class scale
- Build separate enroll → invoice → pay flows (use unified enrollment)
