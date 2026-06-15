# /check — Pre-commit Quality Check

Run this before every commit to catch type errors, lint issues, and test failures.

## Full check
```bash
npm run typecheck && npm run test
```

## Individual checks
```bash
npm run typecheck    # TypeScript across all packages (zero errors required)
npm run lint         # ESLint across all packages
npm run test         # Vitest unit + integration tests
npm run build        # Full production build (catches TS errors in build config)
```

## If typecheck fails
- Check `packages/shared` first — it's a dependency of everything. Build it: `cd packages/shared && npm run build`
- Then check `apps/api`, `apps/web`, `apps/worker` individually

## If tests fail
- Run targeted: `cd apps/api && npx vitest run src/{module}/{module}.service.spec.ts`
- Check that Docker services are up (`npm run db:up`) before running integration tests

## Before opening a PR
```bash
npm run typecheck && npm run test && npm run build
```
All three must pass with zero errors.
