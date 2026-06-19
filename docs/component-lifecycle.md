# Component lifecycle tracking

Use this document with `apps/web/components/pds/registry.ts` to track every UI component from design → code → deprecation. Update both files in the same PR when lifecycle status changes.

## Status definitions

| Status | Meaning |
|---|---|
| `active` | Production-ready; matches current Figma |
| `experimental` | API or visuals may change |
| `deprecated` | Still shipped; do not use in new work |
| `superseded` | Replaced by another registry `id` |

## Change workflow

1. **Design change in Figma** — note node ID and variant prop changes.
2. **Registry** — add or update entry in `PDS_COMPONENT_REGISTRY` with `introducedIn` date and `dependsOn`.
3. **Implementation** — build subcomponents first, then composites (never skip the dependency order).
4. **Storybook** — add or update story with all Figma variants.
5. **Tests** — interaction test + variant class assertions.
6. **Docs** — update `docs/component-library.md` composition tree if dependencies changed.

## Dependency order (build sequence)

Build atoms and composites before feature assemblies. **Assembly is not ownership** — Options and Button stay importable on their own after they exist.

```text
1. radio-box, check-box, button, divider     ← subcomponents (global)
2. option-items (default → radio → checkbox) ← composite rows
3. options                                   ← composite panel (uses OptionItem + Button)
4. select_item/position                      ← layout shell (slot for any panel)
5. select (PdsSelect)                        ← optional assembly of the above
```

## Reuse boundaries

| Do | Don't |
|---|---|
| Import `Options` for any list-in-a-panel UX | Assume `Options` only works inside `PdsSelect` |
| Import `Button` directly for any CTA | Duplicate button CSS in a composite footer |
| Pass custom `children` to `SelectItemPosition` | Hard-code Select-only content in the position shell |
| Use `PdsSelect` when you need the full Figma select field | Rebuild Options markup inline in a new screen |

## Supersession log

| Old | New | Date | Notes |
|---|---|---|---|
| `ui-select-legacy` (`components/ui/select.tsx`) | `select` + `select-field` | 2026-06-19 | Removed; all dashboard selects migrated to `PdsSelectField` |
| `shared/checkbox-list` (native inputs) | `pds/composites/checkbox-list` | 2026-06-19 | Uses `CheckBox` + PDS `Button` toolbar |

## Adding a new component

```ts
{
  id: "my-component",
  name: "My Component",
  figmaNodeId: "XX:YYYY",
  figmaFileKey: FIGMA_FILE_KEY,
  codePath: "apps/web/components/pds/...",
  status: "active",
  dependsOn: ["divider", "button"],
  introducedIn: "YYYY-MM-DD",
}
```

## Deprecating a component

1. Set `status: "deprecated"` and `supersededBy: "<new-id>"` in registry.
2. Add `@deprecated` JSDoc on the export.
3. Keep Storybook story with a deprecation note in `parameters.docs.description`.
4. Remove from docs composition tree after all call sites migrate.

## Audit checklist (quarterly)

- [ ] Every `active` registry entry has a Storybook story
- [ ] Every `active` registry entry has at least one vitest file
- [ ] Figma node IDs still resolve in Pujuba file `ijAgEelM6OgifzPI0R5BoQ`
- [ ] No composite reimplements subcomponent CSS inline
- [ ] `npm run test -w @sms/web` passes
- [ ] `npm run storybook:build -w @sms/web` passes

## Owners

| Area | Path | Primary contact |
|---|---|---|
| PDS subcomponents | `apps/web/components/pds/subcomponents/` | Web platform |
| PDS composites | `apps/web/components/pds/composites/` | Web platform |
| Legacy shadcn wrappers | `apps/web/components/ui/` | Web platform |
| Tokens | `tokens.json` → `design-tokens.css` | Design systems |
