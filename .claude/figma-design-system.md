# Figma ↔ tps_SMS Design System Integration Rules

Use this document when implementing Figma designs into the tps_SMS codebase or when pushing code components into Figma via MCP. It is the single source of truth for mapping Figma tokens, components, and patterns to their code equivalents.

---

## 1. Token Pipeline

### Source files (do not edit generated output)

| File | Role |
|---|---|
| `tokens/semantic.json` | Semantic token definitions (edit this) |
| `tokens/extensions.json` | Extension/override tokens (edit this) |
| `tokens.json` | Figma variables export (source of primitives) |
| `composite_tokens.json` | Composite Figma export |
| `apps/web/app/design-tokens.css` | **Generated** — 572 CSS custom properties (run `npm run tokens:build`) |
| `apps/web/app/design-tokens.dtcg.json` | **Generated** — DTCG format export |

**Rule:** Never hardcode hex values or pixel sizes in components. Always reference a `--pds-*` token. To add a new token, edit `tokens/semantic.json` then run `npm run tokens:build`.

### Naming convention

```
--pds-{category}-{subcategory}-{variant}
```

| Category | Example |
|---|---|
| Primitives | `--pds-color-spring-green-500` |
| Semantic background | `--pds-background-canvas` |
| Semantic text | `--pds-text-primary` |
| Semantic border | `--pds-border-color-primary` |
| Brand | `--pds-brand-accent`, `--pds-brand-dark`, `--pds-brand-ink` |
| Spacing gap | `--pds-gap-small` (8px) |
| Spacing padding | `--pds-padding-medium` (16px) |
| Radius | `--pds-radius-8` |
| Size | `--pds-size-medium` (24px) |
| Typography | `--pds-type-title-m-extrabold` |
| Breakpoint | `--pds-breakpoint-md` (720px) |

---

## 2. Color Palette

### Brand primitives

| Token | Hex | Use |
|---|---|---|
| `--pds-color-spring-green-1000` | `#0a2a1d` | Sidebar shell, dark hero bg |
| `--pds-color-spring-green-950` | (near-black green) | Body text, icons on light bg |
| `--pds-color-spring-green-850` | `#184e33` | Brand dark |
| `--pds-color-spring-green-500` | `#2b8859` | Brand accent mid |
| `--pds-color-spring-green-50` | `#f4f7f1` | App canvas background |
| `--pds-color-chartreuse-green-500` | `#d7f525` | **Primary CTA (lime)** — one per view |
| `--pds-color-chartreuse-green-800` | `#99ae1e` | Active border, hover lime |

### Semantic aliases (use these in components)

```css
--pds-background-canvas           /* App bg = spring-green-50 */
--pds-background-card             /* Panels, inputs = white */
--pds-background-frame            /* Frame sections = spring-green-50 */
--pds-background-layout-primary   /* Page bg = neutral-50 */
--pds-background-layout-secondary /* Subtle section bg = neutral-100 */
--pds-border-color-primary        /* 1px borders = neutral-150 */
--pds-border-color-active         /* Active/focus border = chartreuse-800 */
--pds-brand-accent                /* spring-green-500 */
--pds-brand-dark                  /* spring-green-850 */
--pds-brand-ink                   /* spring-green-950 */
--pds-compliment-brand            /* chartreuse-green-500 (lime CTA) */
--pds-muted                       /* Sage text = neutral-500 */
--pds-shell                       /* Sidebar bg = spring-green-1000 */
```

### Status colors

```css
--pds-status-success   /* green-600  = #15803d */
--pds-status-error     /* red-danger = #c0392b */
--pds-status-warning   /* yellow-600 */
--pds-status-info      /* blue-800   = #1d4ed8 */
```

### Tailwind utilities (mirrored from tokens)

```tsx
// Use these Tailwind classes when inline styling is needed
bg-background      // --pds-background-layout-primary
bg-card            // --pds-background-card
text-foreground    // --pds-text-primary
border-border      // --pds-border-color-primary
bg-brand           // --pds-compliment-brand (lime)
text-brand-ink     // --pds-brand-ink (forest)
bg-shell           // sidebar forest bg
```

---

## 3. Typography

Two typefaces, never mix them outside their roles:

| Face | Variable | Role |
|---|---|---|
| **Bricolage Grotesque** | `--pds-font-family-display-stack` | Titles, numerics, hero headings |
| **Hanken Grotesk** | `--pds-font-family-body-stack` | Body copy, labels, UI text |

Tailwind aliases: `font-sans` (Hanken) · `font-heading` (Bricolage)

### Type scale

| Token | Size | Weight | Use |
|---|---|---|---|
| `--pds-type-title-xl-extrabold` | 26px | 800 | Page hero title |
| `--pds-type-title-m-extrabold` | 22px | 800 | Section title |
| `--pds-type-title-s-extrabold` | 18px | 800 | Card heading |
| `--pds-type-title-s-medium` | 18px | 600 | Sub-heading |
| `--pds-type-title-xs-bold` | 16px | 700 | Panel head |
| `--pds-type-title-xxs-extrabold` | 14px | 800 | Compact heading |
| `--pds-type-display-m` | 28px | 800 | Hero / stat value |
| `--pds-type-body-l-medium` | 16px | 500 | Body copy |
| `--pds-type-body-m-bold` | 14px | 700 | Table header, label |
| `--pds-type-body-m-medium` | 14px | 500 | Table cell, default UI |
| `--pds-type-body-s-bold` | 13px | 700 | Field label |
| `--pds-type-body-s-semibold` | 12px | 600 | Badge, chip |
| `--pds-type-body-s-regular` | 13px | 400 | Helper text |
| `--pds-type-caption-m` | 12px | 700 | Table header (UPPERCASE, 1.2px LS) |
| `--pds-type-caption-s` | 10px | 700 | Eyebrow labels (UPPERCASE) |
| `--pds-type-label-s-bold` | 10px | 700 | Micro labels |

Composite utility classes (set font + size + weight + line-height atomically):
```css
.pds-type-title-m-extrabold
.pds-type-body-m-medium
/* etc — one class per row in the scale above */
```

---

## 4. Spacing & Layout

### Grid: Material 4dp base

```css
--pds-gap-xx-small:  2px
--pds-gap-x-small:   4px
--pds-gap-small:     8px
--pds-gap-medium:    12px
--pds-gap-large:     16px
--pds-gap-x-large:   24px

--pds-padding-xx-small: 4px
--pds-padding-x-small:  8px
--pds-padding-small:    12px
--pds-padding-medium:   16px
--pds-padding-large:    20px
--pds-padding-x-large:  24px
--pds-padding-xx-large: 28px
```

Tailwind spacing is aliased: `gap-0`=2px · `gap-1`=4px · `gap-2`=8px · `gap-3`=12px · `gap-4`=16px · `gap-6`=24px

### Layout constants

```css
--pds-width-1180:  1180px   /* Content max-width */
--pds-width-240:   240px    /* Standard control/card width */
--pds-size-jumbo:  236px    /* Sidebar width */
```

### Breakpoints

```css
--pds-breakpoint-sm: 640px
--pds-breakpoint-md: 720px
--pds-breakpoint-lg: 960px
```

### Border radius

```css
--pds-radius-4:    4px     /* Compact tags */
--pds-radius-8:    8px     /* Inputs, small cards */
--pds-radius-12:   12px    /* Chips */
--pds-radius-14:   14px
--pds-radius-16:   16px
--pds-radius-24:   24px    /* Panels, table cards */
--pds-radius-base: 20px    /* Default rounded */
--pds-radius-pill: 999px   /* Buttons, badges */
```

---

## 5. Component Library

### 5a. Padauk layout wrappers (`apps/web/app/lib/`)

These are thin React components that wrap CSS classes. When implementing a Figma frame, choose the right wrapper first.

```tsx
// White card section
import { Panel, PanelHead } from '@/app/lib/panel'
<Panel>
  <PanelHead title="Section" actions={<button>...</button>} />
  {children}
</Panel>

// Forest-bg hero banner (detail pages)
import { DetailHero } from '@/app/lib/detail-hero'
<DetailHero
  title="Ma Hnin Hnin"
  meta="Grade 3 · Enrolled 2024"
  markText="MH"
  markIcon="person"
  markColor="#2b8859"
  actions={<button className="btn-primary">Edit</button>}
/>

// Sortable, clickable data table
import { DataTable } from '@/app/lib/data-table'
<DataTable
  columns={columns}
  data={rows}
  getRowHref={(row) => `/students/${row.id}`}
/>

// Sidebar record list
import { RecordList, RecordListItem } from '@/app/lib/record-list'
<RecordList>
  <RecordListItem icon="payments" label="Jan Fee" meta="15,000 MMK" />
</RecordList>

// Material Symbols icon
import { Icon } from '@/app/lib/material-icon'
<Icon name="add" />
<Icon name="payments" filled size={32} />
```

### 5b. shadcn/ui primitives (`apps/web/components/ui/`)

Used for overlays and form controls. Match Padauk sizing when combining.

```tsx
import { Button } from '@/components/ui/button'
// buttonType: "filled" | "outlined"
// buttonColor: "primary" | "secondary"
// surface: "light" | "dark"
<Button buttonType="filled" buttonColor="primary">Confirm</Button>
<Button buttonType="outlined" buttonColor="primary">Cancel</Button>

import { Sheet, SheetContent } from '@/components/ui/sheet'
// RecordFormSheet = Sheet @ 480px for create/edit flows

import { Dialog } from '@/components/ui/dialog'
// ConfirmDialog from components/shared/ for destructive confirmations
```

### 5c. Shared components (`apps/web/components/shared/`)

```tsx
// Status badge — maps status string → tone automatically
import { StatusBadge } from '@/components/shared/status-badge'
<StatusBadge status="active" />
<StatusBadge status="overdue" />

// Manual badge
import { Badge } from '@/components/shared/badge'
<Badge tone="success">Paid</Badge>
<Badge tone="danger">Overdue</Badge>
<Badge tone="warning">Pending</Badge>
<Badge tone="info">Draft</Badge>
<Badge tone="neutral">Inactive</Badge>
<Badge tone="brand">New</Badge>

// Metric card
import { StatCard, StatGrid } from '@/components/shared/stat-card'
<StatGrid>
  <StatCard label="Total Students" value={248} accent />
  <StatCard label="Collected" value="4,500,000 MMK" hint="This term" />
</StatGrid>

// Chip / tag
import { Chip, ChipGroup } from '@/components/shared/chip'
<ChipGroup>
  <Chip dotColor="#2b8859">Grade 3</Chip>
  <Chip>2024–25</Chip>
</ChipGroup>

// Selection UI
import { OptionChip, OptionChipGrid } from '@/components/shared/option-chip'
<OptionChipGrid>
  <OptionChip selected onClick={fn}>Monthly</OptionChip>
  <OptionChip onClick={fn}>Termly</OptionChip>
</OptionChipGrid>

// Empty state
import { EmptyState } from '@/components/shared/empty-state'
<EmptyState icon="groups" title="No students yet" description="Enroll your first student to get started." action={<button>Enroll</button>} />

// Confirm dialog
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
<ConfirmDialog title="Delete invoice?" description="This cannot be undone." onConfirm={fn} />
```

---

## 6. CSS Class Reference

All classes are defined in `apps/web/app/globals.css`.

### Dashboard shell

```html
<div class="dash">
  <aside class="dash-sidebar">
    <div class="dash-brand">...</div>
    <nav class="dash-nav">
      <a class="dash-nav-link dash-nav-link--active" href="#">Students</a>
    </nav>
    <div class="dash-user-card">...</div>
  </aside>
  <main class="dash-main">
    <header class="dash-topbar">...</header>
    <div class="dash-content">
      <!-- page content here -->
    </div>
  </main>
</div>
```

### Page body

```html
<div class="page-stack">
  <!-- DetailHero (optional) -->
  <div class="panel">
    <div class="panel-head">
      <span>Section Title</span>
      <div class="panel-actions"><button>...</button></div>
    </div>
    <div class="panel-body">...</div>
  </div>
</div>
```

### Table

```html
<div class="padauk-table-wrap">
  <table class="padauk-table">
    <thead>
      <tr><th>Student</th><th class="padauk-table__num">Amount</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><a class="padauk-table__link" href="#">Ma Hnin</a></td>
        <td class="padauk-table__num padauk-table__amount">15,000</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Buttons

```html
<!-- Primary (one per view — lime) -->
<button class="btn-primary">Confirm Enrollment</button>

<!-- Ghost (secondary actions) -->
<button class="btn-ghost">Cancel</button>
<button class="btn-ghost btn-ghost--compact">View</button>
```

### Badges

```html
<span class="badge badge--tone-success">Paid</span>
<span class="badge badge--tone-danger">Overdue</span>
<span class="badge badge--tone-warning">Pending</span>
<span class="badge badge--tone-info">Draft</span>
<span class="badge badge--tone-neutral">Inactive</span>
```

### Stats grid

```html
<div class="stat-grid">
  <div class="stat-card stat-card--accent">
    <span class="stat-label">Total Students</span>
    <span class="stat-value">248</span>
  </div>
  <div class="stat-card">
    <span class="stat-label">Collected</span>
    <span class="stat-value">4,500,000</span>
    <span class="stat-card__hint">This term</span>
  </div>
</div>
```

### Forms

```html
<div class="form-field">
  <span>Full Name</span>
  <input type="text" placeholder="Ma Hnin Hnin" />
</div>
```

### Utilities

```html
<span class="muted">Last updated 3 days ago</span>
<span class="eyebrow">Finance</span>  <!-- lime uppercase label -->
<span class="error-text">Required field</span>
<nav class="breadcrumbs">
  <a class="breadcrumbs__link" href="#">Students</a>
  <span>›</span>
  <span>Ma Hnin</span>
</nav>
```

---

## 7. Icon System

**Library:** Material Symbols Rounded (Google Fonts ligature font)

**Component:** `<Icon name="…" />` from `apps/web/app/lib/material-icon.tsx`

```tsx
<Icon name="add" />                  // 24px outline
<Icon name="payments" filled />      // 24px filled
<Icon name="groups" size={20} />     // 20px outline
```

**Font variation settings:**
- Default: `FILL 0, wght 500, opsz 24`
- Filled: `FILL 1, wght 500, opsz 24`

**Common icon names used in this codebase:**

| Context | Icon name |
|---|---|
| Students | `groups`, `person`, `person_add` |
| Finance / Billing | `payments`, `receipt_long`, `account_balance_wallet` |
| Attendance | `checklist`, `event_available` |
| Grades | `grade`, `school` |
| Discounts | `local_offer`, `percent` |
| Settings | `settings`, `tune` |
| Add / Create | `add`, `add_circle` |
| Edit | `edit` |
| Delete | `delete` |
| Navigate | `arrow_back`, `chevron_right`, `open_in_new` |
| Search | `search` |
| Filter | `filter_list` |
| More options | `more_horiz` |
| Math subject | `calculate` |
| English subject | `menu_book` |
| Science subject | `science` |
| Computer subject | `computer` |

**Do not** use Lucide React icons for new UI (it's present as a secondary dep but not the primary system).

---

## 8. Data Fetching Patterns

When implementing a Figma design that needs live data:

```tsx
// Read — useApiQuery
const { data, isLoading } = useApiQuery<Student[]>(
  tid => `/tenants/${tid}/students`
)

// Write — useApiMutation
const mutation = useApiMutation<CreateStudentDto, Student>(
  (body, tid) => ({
    path: `/tenants/${tid}/students`,
    init: { method: 'POST', body: JSON.stringify(body) }
  }),
  { invalidatePaths: (_, tid) => [`/tenants/${tid}/students`] }
)
```

---

## 9. i18n

Every user-facing string in JSX must use `useTranslations()`. Never hardcode English in JSX.

```tsx
import { useTranslations } from 'next-intl'

function MyComponent() {
  const t = useTranslations('students')
  return <h1>{t('title')}</h1>
}
```

Add keys to **both** `apps/web/messages/en.json` and `apps/web/messages/my.json` simultaneously. Missing Burmese translations are a Critical localization bug.

---

## 10. Form Pattern

Forms use `react-hook-form` + Zod via `apps/web/app/lib/zod-resolver.ts`. Shared schemas come from `@sms/shared`.

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/app/lib/zod-resolver'
import { CreateStudentSchema } from '@sms/shared'

const form = useForm({ resolver: zodResolver(CreateStudentSchema) })
```

Create/edit flows render inside `RecordFormSheet` (shadcn `Sheet` at 480px width).

---

## 11. Page Layout Template

When implementing a new Figma page design:

```tsx
'use client'
import { useTranslations } from 'next-intl'
import { usePageHeader } from '@/app/dashboard/page-header-context'
import { Panel, PanelHead } from '@/app/lib/panel'
import { DataTable } from '@/app/lib/data-table'

export default function MyPage() {
  const t = useTranslations('myModule')
  const { setHeader } = usePageHeader()

  useEffect(() => {
    setHeader({
      title: t('title'),
      breadcrumbs: [{ label: t('nav'), href: '/dashboard/my-module' }],
    })
  }, [])

  return (
    <div className="page-stack">
      {/* Optional DetailHero for detail pages */}
      <Panel>
        <PanelHead title={t('section')} actions={<button className="btn-primary">{t('add')}</button>} />
        <DataTable columns={columns} data={data} />
      </Panel>
    </div>
  )
}
```

---

## 12. Design Principles (enforce in all Figma → code work)

1. **One lime CTA per view.** `--pds-compliment-brand` / `.btn-primary` is the loudest element. Never repeat it.
2. **Borders over shadows.** Use `--pds-border-color-primary` (1px). No `box-shadow` for depth.
3. **No new colors.** All color must come from existing `--pds-*` tokens.
4. **Dense tables.** `12px 20px` cell padding. Sage uppercase headers. No extra whitespace.
5. **Money is sacred.** All currency values use `--pds-type-body-m-bold` or `--pds-type-display-m`, right-aligned (`padauk-table__num`), in MMK Kyat. No decimal places.
6. **Myanmar names.** Always a single `fullName` field — never split into first/last.
7. **Audit trail.** Any confirm step on financial or sensitive data must be a deliberate action (confirm dialog or dedicated confirm step), never a single click.
8. **Localization parity.** Every label, button, error, and placeholder must have a `my.json` entry.
9. **Content max-width 1180px,** left-aligned under `.dash-content`. Never stretch full-bleed.
10. **4dp grid.** All spacing in multiples of 4 (2, 4, 8, 12, 16, 20, 24, 28px).

---

## 13. File Paths Quick Reference

| What | Where |
|---|---|
| Design tokens (source) | `tokens/semantic.json`, `tokens/extensions.json` |
| Design tokens (generated CSS) | `apps/web/app/design-tokens.css` |
| Global CSS classes | `apps/web/app/globals.css` |
| Tailwind config | `apps/web/tailwind.config.ts` |
| Padauk wrappers | `apps/web/app/lib/` |
| shadcn primitives | `apps/web/components/ui/` |
| Shared components | `apps/web/components/shared/` |
| Icon component | `apps/web/app/lib/material-icon.tsx` |
| i18n English | `apps/web/messages/en.json` |
| i18n Myanmar | `apps/web/messages/my.json` |
| Page header context | `apps/web/app/dashboard/page-header-context.tsx` |
| Zod resolver | `apps/web/app/lib/zod-resolver.ts` |
| cn() utility | `apps/web/lib/utils.ts` |
| Shared schemas/roles | `packages/shared/src/` |
