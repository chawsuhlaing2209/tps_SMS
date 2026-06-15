# /add-migration — Add a Drizzle Migration

## Workflow

1. **Edit the schema** in `apps/api/src/db/schema.ts`
2. **Generate the migration** (creates SQL file in `apps/api/drizzle/`):
```bash
npm run db:generate
```
3. **Review the generated SQL** — open the new file in `apps/api/drizzle/` and verify it looks correct before applying.
4. **Apply the migration**:
```bash
npm run db:migrate
```

## Common patterns

### New table
```typescript
export const myTable = pgTable('my_table', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  status: recordStatus('status').notNull().default('active'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('my_table_tenant_idx').on(t.tenantId),
  index('my_table_tenant_status_idx').on(t.tenantId, t.status),
])
```

### Add column to existing table
```typescript
// In the table definition, add:
newColumn: text('new_column'),

// Then generate + migrate as above
```

### Add index
```typescript
// In the table's second argument array:
index('table_column_idx').on(t.columnName),
```

## Rules
- Always include `tenantId` on tenant-owned tables
- Always include `createdAt`, `updatedAt`
- Add indexes for any column used in WHERE filters or ORDER BY
- Never edit migration files by hand after generation — regenerate instead
- Migration files are append-only in version control
