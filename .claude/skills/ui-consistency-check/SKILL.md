---
name: ui-consistency-check
description: Audit the tps_SMS web UI for inconsistencies and reuse violations — duplicate components/CSS when a reusable one exists, unnecessary wrapper layers added only for padding, double borders from redundant wrapping divs, inconsistent layout/patterns across pages, weird/unintuitive layouts, wrong or raw values where a design token should be used (hardcoded hex/px instead of --pds-* tokens and .pds-type-* classes), missing padding/margin where spacing is needed, and cross-system UI parity (states, actions, forms, tables, formatting, page chrome, i18n). It also REQUIRES rendering and screenshotting each surface (via the run-sms skill / preview_* tools) to catch rendered defects that code review misses — multi-line/wrapping buttons, cramped spacing, misused dividers, misalignment, overflow, and low contrast. Use when reviewing a page, a diff, or a feature area for UI quality, or before shipping a UI change. Produces a findings report (by category + severity) and a fix plan that points each issue to the canonical reusable component/class.
---

# UI consistency check (tps_SMS web)

The web app (`apps/web`, Next.js + Tailwind + Padauk design system) has a rich set of **reusable components and global classes**. Most UI inconsistencies come from re-inventing these or wrapping them in extra structure. This skill tells you the canonical inventory, the five things to check, how to detect each, and what to output.

**Read this first, then audit the requested scope.** All paths are relative to the repo root.

## The reusable inventory — check here BEFORE flagging or building anything

A "new component / new class while a reusable one exists" finding is only valid if a suitable reusable thing already exists. Know the inventory:

- **`apps/web/app/lib/`** — Padauk page-level wrappers: `panel.tsx` (`Panel`, `PanelHead`), `data-table.tsx` (`DataTable`), `table-panel.tsx` (`TablePanelHead`/`TablePanelBody`/`DataTableSection`), `table-search.tsx`, `detail-hero.tsx`, `record-list.tsx` (`RecordList`/`RecordListItem`/`RecordListPanel`), `record-sheet.tsx` (`RecordFormSheet`), `record-modal.tsx`, `hero-more-actions.tsx` (`HeroPrimaryAction`/`HeroMoreActionsMenu`), `pagination-controls.tsx`, `form.tsx` (`Field`), `material-icon.tsx` (`Icon`), `money.tsx` (`formatMMK`).
- **`apps/web/components/pds/`** (barrel `index.ts`) — design-system primitives: `ToggleList`/`ToggleListItem`/`ToggleListSectionHead`, `InvoiceDetails`, `CheckBox`, `PdsSelectField`, `PdsDatePickerField`, `SegmentedControl`, `FilterTabs`, `SearchBar`, `Modal`, `DetailCard`, `InfoCard`, `Breadcrumb`, `TopNavBar`, `EntityList`, `Select`, `DiscountToggleList`.
- **`apps/web/components/shared/`** — `ConfirmDialog`, `EmptyState`, `Badge`/`StatusBadge` (`badge.tsx`), `form-input.tsx` (`TextInput`, `TextAreaInput`, `FormSelect`, `MobileInput`, `PercentInput`), `input-wrapper.tsx` (`InputWrapper`, `FormField`), `PaymentMethodPicker`, `RowMoreActionsMenu`, `Toggle`, `SelectionCard`, `StatCard`/`StatGrid` (`stat-card.tsx`), `Stepper`, `Chip`, `OptionChip`, `NavigationBackLink`, `TrailLink`, `CheckboxList`, `SegmentedControl`.
- **`apps/web/components/ui/`** — shadcn primitives: `Button`, `Dialog`, `Sheet`, `Table`, `Tabs`, `Label`, `Separator`.
- **`apps/web/app/globals.css`** — global Padauk component classes: `.panel` (+ `PanelHead`), `.padauk-table`, `.btn-primary` / `.btn-ghost`, `.badge badge--*`, `.page-stack`, `.dash-content` (content max-width 1180px), `.empty-state`, `.stat-card`, `.row-action`, plus the `.pds-type-*` typography scale.
- **Tokens** — `apps/web/app/design-tokens.css` (generated) + `apps/web/tailwind.config.ts` mirror CSS variables (`--pds-*`). **Never hardcode hex**; use `var(--pds-...)` or a token utility.
- **Page chrome** — pages publish title/breadcrumbs/actions via `PageHeader` (`app/dashboard/page-header-context.tsx`); body is `.page-stack` → optional `DetailCard` → `.panel` sections.

Quick reuse lookups:
```bash
# does a reusable component already cover this?
grep -rn "export function <Name>\|export const <Name>" apps/web/components apps/web/app/lib
# is a global class already defined for what a new CSS-module class re-implements?
grep -nE "^\.(panel|padauk-table|btn-primary|btn-ghost|badge|empty-state|stat-card)\b" apps/web/app/globals.css
```

## Token vocabulary (for checks 6 & 7)

- **Color** — `--pds-color-*`, `--pds-text-*`, `--pds-background-*`, `--pds-border-*`, `--pds-status-*`, `--pds-foreground-*`, `--pds-brand-*`. Pick by role: text → `--pds-text-*`, surface → `--pds-background-*`, borders → `--pds-border-*`, status pills → `--pds-status-*`.
- **Spacing** — `--pds-gap-small | -medium | -large | -x | -xx`, `--pds-padding-*`. Layout rhythm comes from `.page-stack` (between sections) and component padding (`.panel`, `DetailCard`, `RecordFormSheet` body).
- **Radius** — `--pds-radius-4 | -8 | -12 | -14 | -16 | -24 | -base | -pill` (and the `--pds-border-radius-*` aliases).
- **Typography** — the `.pds-type-*` classes (e.g. `pds-type-body-m-bold`, `pds-type-title-s-extrabold`, `pds-type-caption-s`) and `--pds-type-*` / `--pds-font-*` variables. Never set raw `font-size`/`font-weight`.
- **Sizes** — `--pds-size-*` for control/icon sizing.

## The checks

### 1. Duplicate component / CSS class while a reusable one exists
- A locally-defined `function FooCard()/FooPanel()/FooTable()` or inline markup that re-implements `StatCard`, `SelectionCard`, `Panel`, `DataTable`, `EmptyState`, `Badge`, `ConfirmDialog`, `RecordFormSheet`, a toggle list, etc.
- A CSS-module class that re-implements a global class (same `background` + `1px border` + `border-radius` as `.panel`; a bespoke button instead of `.btn-primary`; a bespoke pill instead of `.badge`).
- Raw `<input>/<select>/<textarea>` instead of `TextInput`/`FormSelect`/`TextAreaInput`; raw `<button class="btn-primary">` where a shared `Button`/action exists in that area.
- Detect: `grep -rn "border:\s*1px solid\|border-radius" apps/web/app/**/**.module.css` and compare to `.panel`; compare new component names to the inventory; look for two components doing the same job in the same area.

### 2. Unnecessary layers added only for padding/margin
- A `<div>` whose only purpose is to add padding/margin around a child that already owns its spacing (`.panel`, `.page-stack`, `DetailCard`, `RecordFormSheet` body). Single-child wrappers with only `padding`/`margin`/`gap`.
- Detect: nested `<div><div className={onlyPadding}>…</div></div>`; CSS-module classes with **only** `padding`/`margin` wrapping a `.panel`/component. Prefer the component's own spacing props or the `.page-stack` gap.

### 3. Double borders from redundant wrapping
- A bordered wrapper (`border` / `.card` / a `.module.css` class with `border`) around something that **already** has a border: `.padauk-table`, `.panel`, `InvoiceDetails`, `DataTable`, a `.text-input`. Result: a 2px "double frame".
- Detect: `border` on a parent whose child also sets `border` (e.g., `.tableCard { border } > .padauk-table { border }`); a `.panel` nested directly inside another `.panel`. Fix: drop one border (usually the wrapper) or use the component bare.

### 4. Inconsistent layout / pattern across the system
- A page not using `PageHeader` + `.page-stack` + `.panel`/`PanelHead` like its siblings; mixing shadcn `<Button>` and raw `.btn-primary` for the same role; mixing `TextInput` and raw `<input>`; different table treatments (`DataTable` vs hand-rolled `<table>`); inconsistent empty states (custom vs `EmptyState`); different modal mechanisms for the same job (`RecordFormSheet` vs ad-hoc `Dialog`).
- Inconsistent spacing/typography: hardcoded `px` gaps instead of `--pds-gap-*`; raw font sizes instead of `.pds-type-*`.
- Detect: compare the audited page against 2–3 sibling pages in the same area (`apps/web/app/dashboard/<area>/`) and note where it diverges.

### 5. Weird / unintuitive layout or pattern
- Fixed widths that overflow or don't match the content column; content escaping the `.dash-content` 1180px max-width; misaligned or duplicated action buttons; modal/sheet sizes that don't match siblings; off-grid spacing; primary actions hidden or buried; tappable rows without affordance; color/hex not from tokens.
- Detect: read the JSX + its CSS; sanity-check against the design conventions in `CLAUDE.md` ("Design System") and `DESIGN.md`.

### 6. Wrong or raw values where a design token belongs
- **Hardcoded color** — any `#hex`, `rgb()/rgba()/hsl()`, or named CSS color (`white`, `black`, `red`) in a `.tsx` style/`className` or a `.module.css`, instead of a `--pds-color-*`/`--pds-text-*`/`--pds-background-*`/`--pds-border-*` token. This is a hard rule in `CLAUDE.md` ("Never hardcode hex in components").
- **Raw spacing/radius/size** — literal `px`/`rem` for `gap`/`margin`/`padding`/`border-radius`/control size where a `--pds-gap-*`/`--pds-padding-*`/`--pds-radius-*`/`--pds-size-*` token exists (a small one-off `1px` border or `0` is fine; a `16px`/`24px`/`12px` that matches a token is not).
- **Raw typography** — `font-size`/`font-weight`/`line-height` set by hand, or a bespoke text style, instead of a `.pds-type-*` class.
- **Wrong token role** — using a token from the wrong family (e.g. a brand/color token for body text where `--pds-text-*` exists, or a `--pds-gap-*` value for a radius). The value may "look right" but drifts when tokens change.
- Detect:
  ```bash
  # hardcoded colors in components / module css
  grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(" apps/web/app apps/web/components --include=*.tsx --include=*.module.css | grep -v "design-tokens.css"
  # raw px for spacing/radius (candidates to tokenize)
  grep -rnE "(padding|margin|gap|border-radius)\s*:\s*[0-9]+(px|rem)" apps/web/app/**/**.module.css
  # raw font sizing instead of .pds-type-*
  grep -rnE "font-(size|weight)\s*:" apps/web/app apps/web/components --include=*.module.css --include=*.tsx
  ```
  Then map each literal to the nearest token in the vocabulary above; if none matches, that itself is a finding (off-scale value).

### 7. Missing padding/margin where spacing is needed (the inverse of #2)
Check #2 flags *extra* layers; this flags *absent* spacing that makes the UI cramped or unreadable.
- Content flush against a container edge — a `.panel`/`DetailCard`/bordered box whose children have **no padding**, so text/controls touch the border.
- Stacked sections with **no rhythm** — sibling blocks rendered without `.page-stack` (or any `gap`/`margin`), so panels/headers butt together.
- Flex/grid rows with **no `gap`** — buttons, chips, badges, icon+label pairs crammed edge-to-edge.
- List/table rows with no vertical padding (rows feel dense/unreadable); form fields with no spacing between label, control, and help text (prefer `InputWrapper`/`Field`, which own this).
- Action clusters (footer buttons, header actions) with no gap between them.
- Detect: elements that set `border`/`background` but no `padding`; flex/grid containers with multiple children and no `gap`; sequences of sibling blocks with neither a `.page-stack` ancestor nor `margin`/`gap`. Fix with the component's own spacing, `.page-stack`, or a `--pds-gap-*` token — not a new wrapper.

## UI parity checks (consistency of the *same concept* across the system)

Parity = the same kind of thing looks and behaves the same everywhere. For the audited surface, compare each concept below against how 2–3 sibling pages do it, and flag drift. These are the parity dimensions worth checking in tps_SMS:

1. **State parity** — every list/table renders empty via `EmptyState`, loading via the same skeleton/`muted` loading text, and errors via the same `error-text` treatment. No bespoke "No data" markup.
2. **Action parity** — primary action lives top-right (`PageHeader`/`HeroPrimaryAction`); overflow/row actions use `RowMoreActionsMenu`/`HeroMoreActionsMenu`; destructive actions always route through `ConfirmDialog`; verb labels reuse the same `common` i18n keys ("Add"/"Edit"/"Archive"/"Cancel"/"Save").
3. **Form parity** — create/edit flows use `RecordFormSheet` (480px) with `react-hook-form` + `zodResolver`, fields from `form-input`/`InputWrapper`/`Field`, and the same footer (ghost Cancel + primary submit) and inline error style.
4. **Table parity** — tables use `DataTable`/`.padauk-table` with the same header typography, row hover/click affordance, `RowMoreActionsMenu` for row actions, `TableSearchInput` for search, and `PaginationControls` for paging.
5. **Status/badge parity** — statuses render through `Badge`/`StatusBadge` with the shared `--pds-status-*` color mapping — never ad-hoc colored pills with the same meaning.
6. **Formatting parity** — money via `formatMMK` (label "MMK"), dates via the shared date formatter/`PdsDatePickerField`, numbers/locale consistent. No hand-rolled `toLocaleString` for money.
7. **Modal/sheet parity** — the same overlay mechanism for the same job (side `Sheet`/`RecordFormSheet` for forms, `Dialog`/`Modal` for confirmations/details), at the same sizes, with a title + optional help header.
8. **Page-chrome parity** — every page publishes `PageHeader` (title + breadcrumbs + actions), wraps the body in `.page-stack`, and stays inside `.dash-content` (max-width 1180px). Breadcrumb trails follow the same group→area→record shape.
9. **i18n parity** — no hardcoded English in JSX; every key exists in **both** `messages/en.json` and `messages/my.json` (a key in one but not the other = runtime `MISSING_MESSAGE`). Validate keys used vs. present.
10. **Icon parity** — icons via `<Icon name="…" />` (Material Symbols Rounded) at consistent sizes; no stray emoji or inline SVGs where an icon name exists.
11. **Permission-gating parity** — the same `hasAnyPermission(...)` pattern hides the same class of action across pages (e.g. all manage actions behind the same permission).
12. **Locale-layout parity** — the layout holds for Burmese (longer strings): check the audited screen doesn't overflow/truncate differently between `en` and `my`.

When auditing, you don't need all twelve every time — pick the dimensions the surface actually exercises (a table page → 1,2,4,5,6,8,9; a form sheet → 1,2,3,6,9).

## How to run the audit

1. **Scope it.** Default to the current change (`git diff --name-only` for `apps/web/**`), or audit the page/area the request names. List the `.tsx` + `.module.css` files in scope.
2. **For each file:** read it, run the greps above, and compare against the inventory and 2–3 sibling pages.
3. **Render and screenshot the surface (required — see next section).** Static analysis misses rendered defects. Drive the app and capture the real pixels before you finalize findings.
4. **Classify each finding:** category (checks 1–7, a parity dimension P1–P12, or a **visual** defect V1–V8), severity — **high** (double border, duplicate component/class, raw control where a shared one is standard, hardcoded color, missing i18n key in one locale, a control wrapping to multiple lines, content overflowing/clipped), **medium** (unnecessary layer, missing spacing that hurts readability, cross-page/parity inconsistency, misused divider, misalignment, raw px/font where a token exists), **low** (token-role polish, minor spacing/typography nits).
5. **For every finding, name the canonical fix** — the exact reusable component or global class to use instead, with its path.

## Visual verification (REQUIRED) — screenshot every audited surface

**Do not sign off from code alone.** Reading `.tsx`/`.module.css` cannot see a button that wrapped to two lines, a section with no breathing room, a divider with no padding, a right-aligned input that isn't aligned, text overflowing a panel, or a token that looks wrong on the rendered background. You **must** render the page and look at it.

**How to capture:** use the **`run-sms`** skill (`.claude/skills/run-sms/driver.mjs` — headless-Chrome CDP driver: builds/starts the app, logs in, navigates, screenshots) or, when a live preview is attached, the **`preview_*`** tools. Capture the relevant states:
- **Default** loaded state of the page.
- **Each meaningful sub-state**: loading, empty, error; and interactive states — open the create/edit `Sheet`/`Modal`, select an item, hover a row, focus an input.
- **A narrow viewport** (~960px and below) to catch wrap/overflow.
- **Burmese (`my`)** locale — longer strings expose truncation/overflow the English render hides.

**Visual-only checklist (V-codes — these are the defects only the render reveals):**
- **V1 · multi-line control** — a button/label/badge wrapping to two lines ("Add / component", "Apply to / all"), or a chip breaking mid-word. Fix: `white-space: nowrap` + adequate `min-width`/`flex-shrink: 0`, or shorter copy.
- **V2 · cramped/absent spacing** — sections butting together, header flush to body, text/controls touching a border, action clusters with no gap (rendered evidence for checks 2 & 7).
- **V3 · divider misuse** — a border/divider with no breathing room on one or both sides, a doubled divider, or a hard rule used where a `.page-stack` gap / whitespace was intended.
- **V4 · misalignment** — controls off a shared baseline/grid; amount inputs not right-aligned within their column; toggle + label + input not vertically centered.
- **V5 · overflow / clipping** — content escaping the panel or `.dash-content`; unexpected horizontal scrollbar; clipped/ellipsised text that shouldn't be.
- **V6 · contrast/legibility** — a token that renders low-contrast on its actual surface (e.g. white/hero text, subtle tints, disabled states). Verify the pixels, not just that *a* token is used.
- **V7 · responsive/locale break** — layout that collapses, overlaps, or overflows at a narrow width or in Burmese.
- **V8 · visual weight & hierarchy** — the eye lands in the wrong place or elements don't sit where their role implies. Check: a **single item stranded in a multi-column grid** so it floats mid-container instead of hugging its edge (e.g. one stat card in a 3-col grid drifting to center — it should right-align); **stats/actions not anchored to the expected edge** (primary metrics and actions hug the right/top-right; labels hug the left); **inconsistent label/typography weight for peer elements** (one form field label uppercase-caption while its siblings are sentence-case; mismatched heading levels for equivalent sections); a **CTA whose emphasis doesn't match its importance** (a primary action styled as a plain text link, or a secondary action louder than the primary). Fix: right-align/anchor via flex `justify-content`, not a fixed grid; give peer labels one shared component (`InputWrapper`/`Field`); use the `Button` variants (`buttonType`/`buttonColor`) so emphasis matches role.

Tag each visual finding `[SEVERITY · Vn]`, cite the screenshot/state it appeared in, and feed it into the findings + plan like any other issue. **After fixing, re-screenshot the same states** to confirm the defect is gone and nothing regressed.

## Output format

Produce a **findings report** then a **fix plan**.

```
## Findings — <scope>
### <file path>
- [HIGH · double-border] <what + where (line)>. Why: <…>. Fix: use <reusable> (`<path>`) / drop wrapper border.
- [HIGH · raw-token] Hardcoded `#1c7a4f` at L42. Fix: `var(--pds-color-green-600)`.
- [MED · missing-spacing] Panel body text flush to border (no padding). Fix: rely on `.panel` padding / add `--pds-gap-medium`.
- [MED · parity:P9-i18n] `noComponentsYet` missing in `my.json`. Fix: add the key.
- [HIGH · V1] "Add component" button wraps to two lines in the 240px rail (see screenshot). Fix: `white-space: nowrap` + `flex-shrink: 0` on `.componentsAdd`.
- [MED · V2] No padding between the rail header and the component list; divider sits flush. Fix: header padding + `.page-stack`/gap.
…

## Fix plan
1. <grouped, ordered step> → <exact replacement: component/class + file>
2. …
(Only structural/visual changes — no behavior change. Reuse existing components; never hardcode hex; keep i18n via useTranslations.)
```

## Guardrails when fixing
- **Reuse over rewrite.** Replace bespoke markup/classes with the inventory component/class; delete the now-dead CSS.
- **No behavior change** — structure/styling only. Keep props, data flow, and i18n (`useTranslations`) intact; user-facing strings stay in `messages/en.json` + `my.json`.
- **No hardcoded hex** — use `--pds-*` tokens.
- **Verify (required)**: `npm run typecheck` after edits, **and re-screenshot every affected state** (default + the sub-states from "Visual verification") via the `run-sms` skill / `preview_*` tools to confirm the fix rendered and nothing regressed — a green typecheck does not prove the UI looks right. Keep each fix small and matched to the surrounding code.
