# Component Usage Guidelines — Selection, Tabs, Chips & Filters

**Read this before building any UI that lets a user pick from a set of options.**
Every "pick one/many" control in the app must map to exactly one of the five jobs
below and use that job's canonical component. Do not create a new variant — if
none of these fit, extend the canonical component (and update this document)
instead of adding a parallel one.

> Audit context (2026-07-03): we found **11 different implementations doing 5
> jobs** — e.g. the archive filter was a segmented control on nine pages but a
> dropdown on two; tabs existed in three visual styles; selectable grade chips
> had three unrelated looks. This document is the synthesis of that audit.

---

## The decision table

Ask: **what is the user actually doing?**

| Job to be done | Canonical component | Import | Rules of thumb |
|---|---|---|---|
| **1. Switch dataset / subpage (tabs)** — the content below changes wholesale (different table, different records) | `FilterTab` + `FilterTabGroup` | `components/pds/composites/filter-tabs` | Optional `count` pill. 2–5 tabs. State usually mirrored in the URL (`?tab=`). Example: People → Students / Guardians / Households; Leaves → Leave types / Staff leave. |
| **2. Scope the *same* list, 2–5 fixed options** — a filter/mode toggle, all options always visible | `SegmentedControl` | `components/pds` | For archive scope specifically, use the specialization **`ArchiveVisibilityFilter`** (`components/shared/archive-visibility-filter`) — never rebuild Active/Archived/All by hand. Other examples: EN/MY switcher, calendar modes. |
| **3. Filter by an attribute with many or dynamic options (>5)** | `PdsSelectField variant="filter"` | `components/pds` | Statuses, grade filter over a table (14 grades ⇒ dropdown, not 14 chips), year pickers. Lives in `PdsSearchFiltersRow`. |
| **4. Choose option(s) as form input, small–medium visible set (≤ ~15)** | `OptionChip` + `OptionChipGrid` | `components/shared/option-chip` | **Multi-select:** default (checkbox indicator communicates "pick several"). **Single-select:** `indicator="none"` (radio-like pill highlight; wrap in a container with `role="radiogroup"` semantics via aria-pressed). Grid layout: default is a two-column card grid (chips with `detail`); use `OptionChipGrid layout="wrap"` for compact label-only pill rows. Examples: Add-subject applicable grades (multi + wrap), enrollment ceremony grade/classroom (single + wrap), optional fee services (multi + grid). |
| **5. Navigate a master–detail record rail** — picking *which record's* workspace to show (not filtering) | `FilterTab` (with `meta`/`badge` slots) inside a scrollable rail | `components/pds/composites/filter-tabs` | Examples: grade rail on School structure and Grades & Classrooms. Visually identical to tabs (job is navigation), may show per-record meta ("1 room") or an Archived badge (pass a `StatusBadge` via `badge`). Archived records add the `pds-filter-tab--archived` class (dashed border, dimmed). |

**Display-only (non-interactive):**

| Purpose | Component |
|---|---|
| Static tag chips (e.g. a teacher's grades) | `Chip` / `ChipGroup` (`components/shared/chip`) |
| Status pills (enrolled/draft/archived…) | `StatusBadge` (`components/shared/badge`) — tone mapping is centralized there |
| Rich pick cards with icon + description (wizard steps) | `SelectionCard` (`components/shared/selection-card`) — only when a chip can't carry the needed explanation |
| Checklist with labels/hints | `CheckboxList` (`components/shared/checkbox-list`, re-exports the pds composite) |

---

## Kept vs let go (audit outcome)

**Kept (canonical):**
- `SegmentedControl` (pds) + `ArchiveVisibilityFilter`
- `FilterTab` / `FilterTabGroup` (pds) — extended with `meta` + `badge`
- `PdsSelectField variant="filter"`
- `OptionChip` / `OptionChipGrid` (shared) — extended with `indicator="none"` single-select mode
- `Chip`/`ChipGroup`, `StatusBadge`, `SelectionCard`, `CheckboxList`, `ToggleList`

**Let go (migrated or deprecated):**
- `IconTagControl` as tabs (benefits, leaves) → **FilterTab**. `icon-tag.tsx` is deprecated for tab jobs.
- `PdsSelectField` as the archive-view filter (students & teachers directories) → **ArchiveVisibilityFilter**.
- `subject-grade-picker__pill` (custom, add-subject sheet) → **OptionChip** (multi).
- `EnrollmentChip` (enrollment ceremony) → thin deprecated wrapper over **OptionChip** `indicator="none"`.
- `setup-grade-chip` (grades-classrooms rail) + `structure-grade-chip` (structure rail) → **FilterTab** with `meta`/`badge`.
- `GradeChip` (pds subcomponent, A–F letter chip) — unused; reserved for a future gradebook. Do not use for grade *levels*.

**Not duplicates (safe):** `components/shared/segmented-control.tsx` and
`components/shared/checkbox-list.tsx` are deprecated re-exports of the pds
composites — import from pds in new code.

**Pending migrations (documented debt, migrate when touching these files):**
- Classroom ops tabs (Classrooms | Gradebook | Leaderboard on structure/room pages) use `SegmentedControl` but are a *tab* job → should become `FilterTab`.
- Student/teacher profile section tabs use `SegmentedControl` → same note.

---

## Rationale (why these lines are drawn)

- **Tabs vs segmented:** tabs change *what* you're looking at; segmented controls
  change *how much / which slice* of the same thing you see. Users scan tabs to
  navigate and segments to filter — mixing the two styles for the same job (as we
  had) makes both unlearnable.
- **Segmented vs dropdown:** if the options are few, fixed, and worth comparing at
  a glance (Active/Archived/All), keep them visible — a dropdown hides state and
  costs a click. If options are many or data-driven (grades, statuses), a dropdown
  avoids wrapping chip walls and scales with data.
- **Multi vs single chips:** multi-select chips need a visible checked indicator
  (users must see "several can be on"); single-select chips read as radio pills —
  an indicator would suggest multi-select. One component, one visual family, two
  indicator modes.
- **Record rails are navigation:** the grade rail behaves like tabs over records,
  so it must look like the tab family, not like form chips.

## Process rule

Before adding any selector UI: (1) find the job in the table above, (2) use that
component, (3) if it genuinely doesn't fit, extend the canonical component and
update this document in the same PR. Never introduce a page-local chip/tab CSS
class again.
