---
name: known-failures
description: SMS web typecheck + ResizeObserver test-env issues — FIXED 2026-06-25
metadata:
  type: project
---

Two web-package issues existed on 2026-06-25 and were **fixed the same day**.
Kept here so the fixes are not accidentally reverted.

1. **Web typecheck (TS2339 `initialStudentId`)** in
   `app/dashboard/finance/invoices/_components/record-payment-modal.tsx`.
   **Cause:** `props.initialStudentId` (a discriminated-union member only present
   on the `roster` variant) was referenced in a `useEffect` deps array outside the
   `props.variant === "roster"` narrowing.
   **Fix:** hoist a narrowed local
   `const initialStudentId = props.variant === "roster" ? props.initialStudentId : null;`
   before the effect and depend on that.

2. **4 web test failures** — `ResizeObserver is not defined` in
   `components/pds/composites/select.test.tsx` (jsdom gap; PDS `options.tsx` uses it).
   **Fix:** no-op `ResizeObserver` polyfill added to `apps/web/vitest.setup.ts` via
   `vi.stubGlobal`.

After fixes: root `npm run typecheck` and `npm run test` both exit 0.
Web suite: 31 passed. If either regresses, this is the pattern to re-apply.
