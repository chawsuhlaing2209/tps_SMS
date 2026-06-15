# /add-permission — Add a New Permission

Permissions are the single source of truth in `packages/shared/src/roles.ts`.

## Steps

1. **Add to the Permission union** in `packages/shared/src/roles.ts`:
```typescript
export type Permission =
  | 'existing.permission'
  | 'your.new.permission'   // ← add here
```

2. **Add to the rolePermissions mapping** — assign to every role that should have it:
```typescript
export const rolePermissions: Record<Role, Permission[]> = {
  school_owner: [
    'existing.permission',
    'your.new.permission',   // ← add here
  ],
  // ... other roles
}
```

3. **Use in controller** with `@RequirePermissions('your.new.permission')` or `@RequireAnyPermissions(...)`.

4. **Gate in frontend** by checking session permissions:
```typescript
const { data: session } = useSession()
const canManage = session?.permissions?.includes('your.new.permission')
```

## Guidelines

- Use dot notation: `domain.action` (e.g. `finance.manage`, `discount.approve`)
- Prefer separate read (`*.view`) and write (`*.manage`) permissions for sensitive domains
- Approval-flow permissions use `*.approve` (e.g. `discount.approve`, `grade.approve`)
- After changes: `npm run typecheck` to verify all permission references are valid
