# tps_SMS Design System

Visual language for the multi-tenant school management platform.

## Design Philosophy

**Two reference products, one unified system:**

**Wise (transferwise.com)** — Trustworthy, institutional, precise. Clean white surfaces, 1px borders, no decorative color. Typography does the heavy lifting. Every pixel earns its place. Users trust this product with money — so should ours (school finance, student records).

**Adaline.ai** — Dense, keyboard-first, power-user optimized. Compact sidebar with icon+label nav, tight data tables (36px row height), collapsible panels, command palette, inline edits. Built for people who live in the tool all day.

**Myanmar context** — Support Burmese (Padauk / Noto Sans Myanmar) alongside Latin. All layouts must accommodate 30–50% longer Burmese strings without breaking. Use Gregorian dates with Burmese/English labels per product decision.

---

## Design Tokens

Defined in `apps/web/tailwind.config.ts` and available as CSS variables.

### Colors

```css
/* Brand */
--color-brand:        #254f1a   /* Forest green — primary actions, sidebar active */
--color-brand-light:  #d2e823   /* Yellow-green — accent, highlights, badges */
--color-brand-muted:  #e8f5e9   /* Soft green — hover states, subtle backgrounds */

/* Surfaces */
--color-surface:      #fafafa   /* Page background */
--color-surface-2:    #f4f4f5   /* Sidebar, secondary areas */
--color-raised:       #ffffff   /* Cards, panels, inputs */

/* Borders */
--color-border:       #e4e4e7   /* Default border (1px) */
--color-border-focus: #254f1a   /* Focus ring */

/* Text */
--color-text:         #18181b   /* Primary text */
--color-text-muted:   #71717a   /* Secondary/muted text */
--color-text-subtle:  #a1a1aa   /* Placeholder, disabled */

/* Semantic */
--color-danger:       #dc2626   /* Errors, destructive actions */
--color-danger-bg:    #fef2f2   /* Danger background */
--color-success:      #16a34a   /* Paid, enrolled, active */
--color-success-bg:   #f0fdf4   /* Success background */
--color-warning:      #d97706   /* Overdue, pending, partial */
--color-warning-bg:   #fffbeb   /* Warning background */
--color-info:         #2563eb   /* Info, links */
--color-info-bg:      #eff6ff   /* Info background */
```

### Typography

**Fonts:**
- Latin: `Plus Jakarta Sans` (400, 500, 600, 700) — loaded from Google Fonts
- Burmese: `Padauk` (400, 700) — fallback to `Noto Sans Myanmar`
- Monospace: `JetBrains Mono` — for IDs, codes, invoice numbers

**Scale (px):**
```
text-2xs   10px  — audit timestamps, footer notes
text-xs    11px  — table cell secondary info
text-sm    12px  — table cells (primary), form labels, badges
text-base  13px  — body, form inputs, sidebar nav
text-md    14px  — card descriptions, secondary headings
text-lg    16px  — page section headings
text-xl    18px  — page titles
text-2xl   20px  — section stat values
text-3xl   24px  — dashboard KPI numbers
text-4xl   28px  — hero / large stat
```

**Weights:**
- 400 — body text
- 500 — labels, table headers, nav items
- 600 — headings, button text, stat values
- 700 — page titles, emphasized values

### Spacing

4px base grid.
```
1 = 4px
2 = 8px
3 = 12px
4 = 16px
5 = 20px
6 = 24px
8 = 32px
10 = 40px
12 = 48px
```

### Border Radius

```
rounded-sm   2px  — badges, chips
rounded      4px  — buttons, inputs, table rows
rounded-md   6px  — cards, panels, dropdowns
rounded-lg   8px  — modals, sheets, dialogs
rounded-xl   12px — feature cards
```

### Shadows

Minimal. Only for elements lifted above the page.

```
shadow-none  — default (borders only)
shadow-xs    0 1px 2px rgba(0,0,0,.06)   — inputs, subtle cards
shadow-sm    0 1px 3px rgba(0,0,0,.10)   — raised cards, panels
shadow-md    0 4px 12px rgba(0,0,0,.12)  — dropdowns, floating elements
shadow-lg    0 8px 24px rgba(0,0,0,.14)  — modals, command palette
```

---

## Layout

### Shell

```
┌─────────────────────────────────────────────────────────────┐
│ TopBar (48px)     tenant name   [bell] [lang] [user menu]   │
├──────────┬──────────────────────────────────────────────────┤
│          │                                                   │
│ Sidebar  │  Page Content                                     │
│ 220px    │  max-width: 1400px                                │
│          │  padding: 24px                                    │
│ (collapsi│                                                   │
│ ble to   │                                                   │
│ 56px)    │                                                   │
└──────────┴──────────────────────────────────────────────────┘
```

- Sidebar: 220px expanded, 56px collapsed (icons only)
- TopBar: 48px height, sticky
- Content: 24px padding, 1400px max-width, centered
- Section gap: 16px between page sections

### Sidebar Navigation

Groups with subtle dividers. Active state: brand green background, white text.

```
[Logo]

  ▸ Overview

  OPERATIONS
  ▸ Students
  ▸ Admissions
  ▸ Classrooms
  ▸ Attendance

  ACADEMICS
  ▸ Timetable
  ▸ Calendar
  ▸ LMS
  ▸ Exams
  ▸ Grades
  ▸ Report Cards

  FINANCE
  ▸ Invoices
  ▸ Payments
  ▸ Fee Plans
  ▸ Discounts
  ▸ Reports

  HR
  ▸ Staff
  ▸ Salary

  [Settings]
  [Audit Log]
```

---

## Components

### PageHeader

```
[title]                              [Primary Action Button]
[description / breadcrumb]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- Title: `text-xl font-600`
- Description: `text-base text-muted`
- Divider: 1px border-bottom
- Primary button: right-aligned

### DataTable

Adaline.ai-inspired: dense, keyboard-navigable, sortable.

```
[Search input]  [Filter: Status ▾]  [Filter: Grade ▾]    [Export ▾]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
☐  Name            Admission#   Grade   Balance    Status    •••
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
☐  Mg Aung Zaw     A-2024-001   G10A    15,000 ks  ● Paid
☐  Ma Hnin Wai     A-2024-002   G10B    --         ● Active
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Showing 1–50 of 342              [← Prev]  Page 1 of 7  [Next →]
```

- Row height: 36px (compact)
- Header: 12px uppercase, 500 weight, muted color
- Cell text: 12px
- Hover: `bg-surface-2` row highlight
- Clickable rows navigate to detail page
- Keyboard: Arrow keys navigate rows, Enter opens detail

### StatCard

```
┌─────────────────────────┐
│ Total Students          │
│                         │
│  1,247          ↑ +12   │
│              vs last mo │
└─────────────────────────┘
```

- White background, 1px border, 8px radius
- Label: 11px uppercase muted
- Value: 28px bold
- Delta: colored (green/red), 11px

### StatusBadge

Compact dot + text. No pill background.

```
● Enrolled    (green)
● Active      (green)
● Paid        (green)
● Pending     (yellow)
● Overdue     (red)
● Partial     (orange)
● Withdrawn   (gray)
● Archived    (gray)
● Invited     (blue)
● Suspended   (red)
```

Usage: `<StatusBadge status="enrolled" />` renders `● Enrolled`.

### FormSheet

Right-side drawer (not full modal) for create/edit forms.

```
                              ┌─────────────────────┐
                              │ Add Student      [×] │
                              │─────────────────────│
                              │ Full Name            │
                              │ [________________]   │
                              │                      │
                              │ Date of Birth        │
                              │ [________________]   │
                              │                      │
                              │ Grade                │
                              │ [Select ▾_________]  │
                              │                      │
                              │─────────────────────│
                              │ [Cancel] [Save]      │
└─────────────────────────────┴──────────────────────┘
```

- Width: 480px (desktop), full-width on mobile
- Slides in from right with 200ms ease
- Footer: Cancel (ghost) + Save (primary) buttons
- Validation errors appear inline below each field

### CommandPalette (Cmd+K)

Global quick action + search overlay.

```
┌──────────────────────────────────────────────────┐
│ ⌘  Search students, invoices, staff…             │
├──────────────────────────────────────────────────┤
│ QUICK ACTIONS                                    │
│   + New Student                                  │
│   + Record Payment                               │
│   + New Enquiry                                  │
├──────────────────────────────────────────────────┤
│ NAVIGATE                                         │
│   → Finance / Invoices                           │
│   → Students                                     │
│   → Attendance                                   │
└──────────────────────────────────────────────────┘
```

- Triggered by `Cmd+K` / `Ctrl+K`
- Max-width: 560px, centered
- Shadow-lg, rounded-lg
- Fuzzy search with highlighted matches

### FilterBar

Inline above every DataTable.

```
[🔍 Search by name or ID…]  [Status ▾]  [Grade ▾]  [Month ▾]   [Export CSV]
```

- Search input: 240px min
- Each filter: compact Select (shadcn/ui)
- Export button: right-aligned, ghost variant

### EmptyState

```
      [Illustration or Icon]

        No students yet

   Enroll the first student to get
   started with class assignments
   and billing.

        [Enroll Student]
```

- Centered in page content area
- Icon: 48px, muted color
- Message: clear, actionable
- CTA button: primary variant

### ConfirmDialog

```
┌──────────────────────────────────┐
│ Cancel Invoice #INV-0042         │
│                                  │
│ This will cancel the invoice and │
│ cannot be undone. Any recorded   │
│ payments will not be affected.   │
│                                  │
│           [Keep]  [Cancel Invoice]│
└──────────────────────────────────┘
```

- Title: action being confirmed
- Body: consequence + irreversibility
- Destructive button: red/danger variant
- Safe option on left, destructive on right

---

## Interaction Patterns

### Loading States

- Skeleton screens (not spinners) for data tables and cards
- Inline spinner only for form submit buttons
- Toast notification for background job progress

### Error States

- Inline field errors: red text below input, 11px
- Form-level errors: red alert banner above submit
- Page-level errors: centered error state with retry button
- Network errors: toast notification

### Optimistic Updates

Apply changes to UI immediately, revert on error.
- Payment recorded → invoice status flips to Paid instantly
- Attendance marked → row updates without page reload
- Show subtle "Saving…" indicator, not full loading state

### Toast Notifications

```
✓ Student enrolled successfully          [×]
✗ Failed to record payment: network error [×]
⟳ Generating invoices… (47/120)          [×]
```

- Position: bottom-right
- Auto-dismiss: 4 seconds (success), persistent (error, progress)
- Max 3 visible at once (stack)

---

## Finance UI Conventions

- All monetary values: `MMK {:,.0f}` format (e.g. `MMK 150,000`)
- Overdue amounts: red text, `● Overdue` badge
- Partial payments: orange `● Partial` badge with remaining balance
- Payment proof uploads: show thumbnail + reference number inline
- Invoice numbers: monospace font, uppercase (`INV-2024-0042`)
- Receipt numbers: monospace font (`RCP-2024-0018`)

---

## Burmese (Myanmar) Language Support

- Font: Padauk 400/700, fallback to Noto Sans Myanmar
- All i18n strings via `next-intl` — never hardcode in JSX
- Date format in Burmese: Gregorian dates with Burmese month names where appropriate
- Number formatting: standard numerals (not Burmese numerals) for finance
- RTL: not required (Myanmar is LTR)
- Test all layouts with Burmese strings (30–50% longer than English)

---

## Accessibility

- WCAG AA contrast minimum on all text
- Focus rings: 2px solid brand color on all interactive elements
- Screen reader labels on icon-only buttons
- `role="status"` on loading states
- `role="alert"` on errors
- Keyboard navigation: all tables navigable with arrows, all modals trap focus

---

## Do / Don't

**Do:**
- Use 1px borders to define space (not shadows or background changes)
- Use color purposefully — only for status, never decoration
- Keep table rows compact — users scan, not read
- Right-align numbers in tables
- Use monospace for IDs, codes, invoice numbers

**Don't:**
- Use gradients, drop shadows on cards, or rounded corners > 8px
- Use more than 2 colors per component (text + accent)
- Show spinners for data that can be skeleton-loaded
- Use full-page modals for forms that fit in a sheet
- Hardcode any color hex values in component files — use CSS variables
