# /db — Database Workflow

Drizzle ORM + PostgreSQL. Schema lives in `apps/api/src/db/schema.ts`.

## Common workflows

### After changing schema.ts — generate + apply migration
```bash
npm run db:generate   # drizzle-kit generates SQL migration file
npm run db:migrate    # applies pending migrations to the database
```
Always review the generated SQL in `apps/api/drizzle/` before applying.

### Fresh start (drop everything and reseed)
```bash
npm run db:reset      # drops DB, recreates, migrates, seeds
```

### Seed demo data only (without reset)
```bash
npm run db:seed
```
Seeds two demo tenants (demo-alpha, demo-beta) with owner + teacher users.

### View pending migrations
```bash
cd apps/api && npx drizzle-kit status
```

## Schema conventions

Every tenant-owned table must include:
```typescript
tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
createdAt: timestamp('created_at').notNull().defaultNow(),
updatedAt: timestamp('updated_at').notNull().defaultNow(),
createdBy: uuid('created_by').references(() => users.id),
```

Add indexes for any column used in WHERE filters:
```typescript
}, (t) => [
  index('students_tenant_status_idx').on(t.tenantId, t.status),
])
```

## Adding a new table

1. Add table definition to `apps/api/src/db/schema.ts`
2. Export it from schema.ts
3. Run `npm run db:generate`
4. Review generated migration
5. Run `npm run db:migrate`
6. Import table in service files using `import { myTable } from '../db/schema'`
