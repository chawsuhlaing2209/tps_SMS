---
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(bun run:*), mcp__figma-desktop__get_design_context, mcp__figma-desktop__get_screenshot, mcp__figma-desktop__get_variable_defs, mcp__chrome-devtools__list_pages, mcp__chrome-devtools__navigate_page, mcp__chrome-devtools__take_screenshot, mcp__chrome-devtools__take_snapshot, mcp__chrome-devtools__evaluate_script
argument-hint: [figma-url]
description: Build a Figma design into code and verify the implementation
---

# Build Figma Design

Build and verify this Figma design: $ARGUMENTS

---

## Prerequisites Check

Before starting, verify both required MCP servers are connected:

1. **Figma MCP** – Attempt to use `mcp__figma-desktop__get_screenshot`. If it fails, guide user to set it up.
2. **Chrome DevTools MCP** – Attempt to call `mcp__chrome-devtools__list_pages`. If it fails, guide user to set it up.

### MCP Setup (if needed)

**Figma MCP:**

1. Open Figma desktop app (not browser)
2. Switch to Dev Mode (bottom toolbar)
3. In right sidebar under "Inspect", click "Set up Figma MCP"
4. Select "Claude Code" and copy the command shown
5. Run the command in terminal, then restart Claude Code

**Chrome DevTools MCP:**

```bash
claude mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest
```

---

## Phase A: Design Extraction

1. Extract the node ID from the Figma URL:
   - `figma.com/design/fileKey/fileName?node-id=123-456` → nodeId is `123:456`
   - Replace `-` with `:` in the node ID

2. Use Figma MCP to fetch design data:
   - `mcp__figma-desktop__get_design_context` for layout, colors, typography
   - `mcp__figma-desktop__get_screenshot` for visual reference

3. Extract key design properties:
   - Layout structure (flexbox, grid, positioning)
   - Colors (hex values, gradients)
   - Typography (font family, size, weight, line height)
   - Spacing (padding, margins, gaps)

---

## Phase B: Implementation

1. Determine the target file:
   - If working in an existing file, edit that component or page
   - If no file exists, create one or ask the user where to place it

2. **Search for existing components** before writing code:
   - `src/components/` – check for any existing UI components that match what's needed
   - If a matching component exists, use it
   - If not, create a new component in `src/components/` following the patterns and naming conventions of existing components in that folder

3. **Use Lucide for icons:**
   - Import directly from `lucide-react`
   - Find the closest matching icon by searching the Lucide icon list
   - Example: `import { ChevronRight, Search } from 'lucide-react'`

4. Write the React component:
   - Use function declarations (not arrow functions)
   - Use Tailwind CSS classes
   - **For colors, spacing, and typography:** check if the project has design tokens mapped to Tailwind (e.g. `bg-primary`, `text-foreground`, `border-border`) — use those if they exist
   - If no token mapping exists, use Tailwind defaults that best match the Figma values (e.g. `bg-zinc-900`, `text-sm`, `rounded-lg`)

---

## Phase C: Verification Loop

After implementing, verify against the Figma design:

### Step 1: Get the Figma Reference

```
mcp__figma-desktop__get_screenshot with the nodeId
```

### Step 2: Navigate to Implementation

```
mcp__chrome-devtools__navigate_page to http://localhost:3000/<path>
```

### Step 3: Screenshot the Implementation

```
mcp__chrome-devtools__take_screenshot
```

### Step 4: Compare Side by Side

Analyze both images and identify discrepancies. Check in this order:

1. **Structure** – Is the DOM hierarchy correct?
2. **Layout** – Flexbox/grid direction, alignment, justification
3. **Spacing** – Padding, margins, gaps (exact px values)
4. **Sizing** – Width, height constraints
5. **Colors** – Background, text, borders (exact hex values)
6. **Typography** – Font size, weight, line height
7. **Borders** – Width, radius, color
8. **Shadows** – Box shadows, drop shadows

### Step 4b: Verify Computed Values (MANDATORY)

A screenshot match is not sufficient. After every visual comparison, use `mcp__chrome-devtools__evaluate_script` to confirm that the **browser's actual computed values** match the Figma spec — not just that the Tailwind class names mathematically map to the right values.

**The win condition is: computed value === Figma value. Not: Tailwind class name × scale factor === Figma value.**

For every property extracted from Figma in Phase A, run `getComputedStyle` on the relevant element and assert the value:

```js
() => {
  const el = document.querySelector('<selector>');
  const cs = getComputedStyle(el);
  return {
    // spacing
    paddingTop: cs.paddingTop,
    paddingBottom: cs.paddingBottom,
    paddingLeft: cs.paddingLeft,
    paddingRight: cs.paddingRight,
    gap: cs.gap,
    // sizing
    width: cs.width,
    height: cs.height,
    borderRadius: cs.borderRadius,
    // colors
    backgroundColor: cs.backgroundColor,
    color: cs.color,
    // typography
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    lineHeight: cs.lineHeight,
    // borders & shadows
    borderWidth: cs.borderWidth,
    boxShadow: cs.boxShadow,
  };
}
```

If **any** computed value does not match the Figma spec, it is a failure — even if the screenshot looks close. Fix it before marking as passing.

> **Why this matters:** CSS utility frameworks (e.g. Tailwind) have non-continuous scales. A class like `pb-18` may silently produce no CSS because `18` is not in the scale. Screenshot comparison cannot catch a missing `72px` bottom padding when the surrounding layout absorbs the difference visually. Computed style verification is the only reliable check.

### Step 5: Fix and Repeat

1. Make targeted code changes to fix discrepancies found in screenshot OR computed style check
2. Re-run `evaluate_script` to confirm the fix landed (computed value now matches)
3. Take a new screenshot and compare again
4. Repeat until all computed values and visuals match (or after 3 iterations, ask user for feedback)

---

## Exit Conditions

**Stop iterating when:**

- Implementation closely matches Figma (near pixel-perfect)
- Need clarification from user (hover states, animations, etc.)
- 3 iterations with minimal improvement – ask user