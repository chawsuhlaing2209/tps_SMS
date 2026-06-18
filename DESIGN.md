# tps_SMS Design System

Visual language for the multi-tenant school management platform

## Design Philosophy

**Two reference products, one unified system:**

**Wise (transferwise.com)** — Trustworthy, institutional, precise. Clean surfaces, 1px borders, restrained color. Typography does the heavy lifting. Users trust this product with money — so should ours (school finance, student records).

**Adaline.ai** — Dense, keyboard-first, power-user optimized. Compact sidebar with icon+label nav, tight data tables, collapsible panels, inline edits. Built for people who live in the tool all day.

**Myanmar context** — Support Burmese alongside Latin. All layouts must accommodate 30–50% longer Burmese strings without breaking. Use Gregorian dates with Burmese/English labels per product decision.

**Padauk identity** — Ink-green shell (`--shell`) + spring-lime CTAs (`--brand`). Rounded frames (18–22px), squircle marks, Material Symbols icons. Hero banners use dark green or gradient shells; everyday content stays white-bordered on paper background.

---

## Design Tokens

### Source of truth

| Layer | Location | Who edits |
|-------|----------|-----------|
| Figma export | `tokens.json` (repo root) | Design |
| App extensions | `tokens/extensions.json` | Engineering |
| Semantic roles | `tokens/semantic.json` | Engineering + design |
| **Generated CSS** | `apps/web/app/design-tokens.css` | **Auto** — `npm run tokens:build` |
| Component classes | `apps/web/app/globals.css` | Engineering |
| Tailwind utilities | `apps/web/tailwind.config.ts` | Engineering (mirrors CSS vars) |

Workflow: edit `tokens/semantic.json` (or extensions) → `npm run tokens:build` → restart web dev server. See `tokens/README.md`.

**Rule:** Never hardcode hex in components. Use CSS variables or Tailwind tokens that map to them.

### Colors (semantic)

Core UI roles (all resolve through `design-tokens.css`):

| Token | Role |
|-------|------|
| `--background` | Page paper (`#f4f7f1`) |
| `--foreground` | Ink green — primary text (`#0a2a1d`) |
| `--muted` | Secondary text |
| `--card` | Panels, inputs, table surfaces |
| `--surface` | Raised neutral (table headers, person cards) |
| `--subtle` | Hover / zebra / soft fills |
| `--border` / `--border-soft` | 1px dividers |
| `--accent` / `--link` | Links, open actions |
| `--brand` | Spring lime — primary CTAs |
| `--brand-ink` / `--brand-dark` | Text on lime buttons |
| `--shell` / `--shell-raise` / `--shell-line` | Sidebar, detail hero, dark banners |
| `--danger` / `--info` | Semantic feedback |

**Status palette** — use `--status-*-bg`, `--status-*-border`, `--status-*-fg` (and `-muted-*` variants) for badges, banners, and callouts. Do not invent one-off reds/greens.

**Category palette** — subject/room squircles: `--cat-blue`, `--cat-coral`, `--cat-teal`, `--cat-lilac`, `--cat-mustard`, `--cat-pink`, `--cat-green`, `--cat-sky`. Hashed via `subjectColor()` in `apps/web/app/dashboard/structure/subject-colors.ts`.

**On-shell text** — `--on-shell-faint`, `--on-shell-soft`, `--on-shell-light`, `--on-shell-error`, plus alpha white tokens for ghost buttons on dark heroes.

### Typography

**Font stacks:**
- Headings / display: **Bricolage Grotesque** (`--font-heading`)
- Body: **Hanken Grotesk** (`--font-sans`)
- Icons: **Material Symbols Rounded** via `<Icon name="…" />` (`apps/web/app/lib/icon.tsx`)
- Burmese: must not break layout at 30–50% longer strings than English

**Composite presets** (from `design-tokens.css` → `--type-*`):

| Preset | Use |
|--------|-----|
| `--type-eyebrow-*` | Section labels (12px uppercase, 700) |
| `--type-display-lg-*` / `--type-display-md-*` | Hero titles |
| `--type-heading-sm-*` | Panel titles |
| `--type-body-md-*` / `--type-body-sm-*` | Default copy (13px / 12px) |
| `--type-label-sm-*` | Form labels, stat labels |
| `--type-stat-value-*` / `--type-stat-label-*` | Metric cards |

Heading elements and `.section-title` use `--font-heading` with `-0.02em` letter-spacing.

### Spatial scale

4px base grid with fine steps for dense UI. **Always use tokens — never magic numbers in new code.**

| Token | Value | Use |
|-------|-------|-----|
| `--space-1` | 4px | Tight inline gaps, badge padding-y |
| `--space-1_5` | 6px | Label → input gap |
| `--space-2` | 8px | Button groups, panel actions |
| `--space-2_5` | 10px | Record list row gap, nav item gap |
| `--space-3` | 12px | **Panel header → body**, side label → card |
| `--space-3_5` | 14px | Form stack row gap |
| `--space-4` | 16px | Page block gap, column gap, topbar gap |
| `--space-5` | 20px | **Frame outer padding** (panels) |
| `--space-6` | 24px | Auth / hero inner padding |
| `--space-7` | 30px | Content horizontal gutter |
| `--space-8` | 40px | Record list icon size |
| `--space-9` | 48px | Mobile bottom padding |
| `--space-10` | 60px | Content bottom gutter |

Fine steps (`--space-0_5`, `--space-3_25`, `--space-6_5`) exist only where the design requires sub-grid alignment.

### Layout tokens

| Token | Value | Use |
|-------|-------|-----|
| `--layout-sidebar-width` | 236px | Shell grid column |
| `--layout-content-max` | **1180px** | Page content max width |
| `--layout-gutter-x` | 30px | `.dash-content` horizontal padding |
| `--layout-gutter-x-compact` | 18px | Mobile content padding |
| `--layout-gutter-y` | 26px | `.dash-content` top padding |
| `--layout-gutter-bottom` | 60px | `.dash-content` bottom padding |
| `--layout-section-gap` | 20px | `.page-stack` between sections |
| `--layout-page-gap` | 16px | Stat grids, inline page blocks |
| `--layout-column-gap` | 16px | Two-column layouts (room detail) |
| `--side-stack-gap` | 16px | Sidebar stacks (homeroom + stats) |

Breakpoints (reference): `--breakpoint-sm` 640px, `--breakpoint-md` 720px, `--breakpoint-lg` 960px.

### Frame tokens (panels & cards)

Every white bordered section uses the **frame** pattern:

| Token | Value | Rule |
|-------|-------|------|
| `--frame-padding` | 20px | Outer inset on `.panel` |
| `--frame-header-body-gap` | 12px | Gap between `PanelHead` and body |
| `--frame-body-gap` | 16px | Gap between items inside `.panel-body` |
| `--frame-label-gap` | 12px | Eyebrow label → card below (e.g. HOMEROOM TEACHER) |
| `--frame-radius` | 22px | Panel corner radius |

**Implementation:** `.panel` / `.structure-panel` = `display: grid; align-content: start; gap: var(--frame-header-body-gap); padding: var(--frame-padding)`.

**Critical:** Panels in multi-column grids must use `align-self: start` (or parent `align-items: start`) so grid row stretch does not inflate header–body gap.

### Border radius

| Token | Value | Use |
|-------|-------|-----|
| `--radius-input` | 10px | Auth inputs, small controls |
| `--radius-sm` | 12px | Form inputs, list item icons |
| `--radius-md` | 15px | Record list rows |
| `--radius-base` / `--radius` | 18px | Tables, stat cards |
| `--radius-card` | 20px | Standalone stat cards |
| `--radius-lg` / `--frame-radius` | 22px | Panels (frames), banners |
| `--radius-pill` | 999px | Buttons, badges, search pills |

### Shadows

Minimal on everyday surfaces — borders define space. Allowed on overlays only:

| Token | Use |
|-------|-----|
| `--shadow-popover` | User menu, hero action menu |
| `--shadow-panel` | Dropdown panels |
| `--shadow-auth` | Login card |
| `--shadow-inset-brand` | Dividers inside brand stat cards |

Modals/sheets: shadcn `shadow-lg` on overlay content.

---

## Layout

### Shell

```
┌─────────────────────────────────────────────────────────────┐
│ TopBar (sticky)     breadcrumb + title    search · AY · bell│
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │  Page Content (max 1180px, left-aligned)         │
│ 236px    │  padding: 26px 30px 60px                          │
└──────────┴──────────────────────────────────────────────────┘
```

- **Grid:** `.dash` — sidebar + main column
- **Sidebar:** `.dash-sidebar` — `--shell` background, sticky full height, grouped nav, user card pinned bottom
- **Top bar:** `.dash-topbar` — title/breadcrumbs from `PageHeader` context; global search (placeholder), working-year badge, notifications
- **Content:** `.dash-content` — gutter tokens; direct children capped at `--layout-content-max`, **left-aligned** (not centered)
- **Between page sections:** `--layout-section-gap` (20px) via `.page-stack`

### Page structure

```
DashboardTopbar (reads PageHeader context)
.dash-content
  .page-stack
    PageHeader (optional — publishes title; may render back link)
    DetailHero (optional — detail pages)
    .subnav (optional — module tabs, e.g. Finance)
    .panel (section 1)
    .panel (section 2)
    …
```

- Titles live in the **top bar**, not inside panels (unless `PanelHead` for a section title).
- Empty/error/loading states belong in `.panel-body` or `TablePanelBody` — not floating between grid rows.
- Module layouts (Finance, Salary, Exams) wrap children in `.page-stack` + `.subnav`.

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

### Page header (`PageHeader` + top bar)

Pages publish metadata via `PageHeader` from `apps/web/app/dashboard/page-header-context.tsx`. The sticky `DashboardTopbar` renders title (25px/800 heading), optional breadcrumb trail, and optional description line.

```tsx
<PageHeader title={t("title")} breadcrumbs={[{ label: t("group") }]} description={t("description")} />
// Detail pages with back navigation:
<PageHeader title={name} backHref="/dashboard/students" backLabel={t("back")} />
```

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

`.working-year-badge` in top bar — links to academic year setup; warning variant when no active year.

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
- Put page titles in the top bar via `PageHeader`
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
