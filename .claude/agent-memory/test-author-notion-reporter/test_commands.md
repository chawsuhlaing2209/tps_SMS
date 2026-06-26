---
name: test-commands
description: Scoped vitest/typecheck commands for the SMS monorepo and the tee exit-code pitfall
metadata:
  type: reference
---

Runner is **Vitest 3.x**. Each workspace: `"test": "vitest run"` (worker uses `--passWithNoTests`).

Scoped commands (run from the workspace dir):
- API single spec: `cd apps/api && npx vitest run src/path/to.spec.ts`
- API all: `cd apps/api && npx vitest run`
- API typecheck: `cd apps/api && npx tsc -p tsconfig.json --noEmit`
- Root all: `npm run test` (runs every workspace); `npm run typecheck`.

**Pitfall:** `npm run test | tee log` reports tee's exit code (0), masking real
failures. Always read each package's Vitest summary line, not the wrapper exit
code. `npm run test` aborts the chain on first failing workspace, so packages
after the failing one (e.g. shared after web) still run because workspaces are
independent `--if-present` invocations — verify each package block in the log.

DB integration tests in `apps/api/src/db/*.test.ts` self-skip without a running
Postgres (`npm run db:up`). 13 such tests skip in a no-DB run.

Mocking patterns that work for NestJS services: instantiate the service directly
(`new SomeService(dbMock, auditMock)`), mock Drizzle with a chainable stub
(`select().from().innerJoin().where()` resolving to queued result arrays; `where`
returns a thenable that also exposes `orderBy`/`limit`). Mock AuditService as
`{ recordEvent: vi.fn(), createEvent: vi.fn(e => e) }`. See
`apps/api/src/enrollments/enrollment-billing.service.spec.ts` for a full example.
