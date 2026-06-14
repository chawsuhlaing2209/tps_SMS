# Tenant Isolation Design

## MVP Model

The MVP uses one shared PostgreSQL database and one shared schema. Every tenant-owned table has a `tenant_id` column and should be queried only through tenant-aware backend services.

## Enforcement Layers

1. Tenant resolver
   - Resolve tenant from subdomain, tenant slug, or school code during login and API requests.
   - Reject ambiguous tenant context before domain logic executes.

2. Application authorization
   - Require a `TenantContext` for tenant-owned routes.
   - Check `context.tenantId` against every tenant-owned record.
   - Enforce role permissions for every list, detail, create, update, delete, import, export, and report action.
   - Apply teacher assignment filters before returning classroom, attendance, LMS, exam, or grade data.

3. Database constraints
   - Add indexes on `tenant_id` and high-volume lookup fields.
   - Keep tenant-scoped uniqueness, such as tenant-specific admission numbers, invoice numbers, and receipt numbers.
   - Add foreign keys for domain integrity.

4. Row Level Security
   - Enable PostgreSQL Row Level Security for high-risk tables once the API database session pattern is finalized.
   - Use a transaction-local setting such as `app.tenant_id` and policies that compare it to `tenant_id`.
   - Keep RLS as a second line of defense; do not replace API permission checks.

## Sensitive Records

Always audit changes to:

- Tenant settings, feature flags, and support access grants.
- Student identity, guardian, enrollment, class assignment, transfer, withdrawal, and document records.
- Attendance submissions and corrections.
- Exam marks, grading rules, grade approvals, and report card publication/corrections.
- Fee plans, invoices, payments, receipt cancellation, discounts, scholarships, salary records, and finance reports.

## File Storage

Files should use tenant-scoped paths:

```text
tenants/{tenantId}/students/{studentId}/documents/{fileName}
tenants/{tenantId}/finance/payments/{paymentId}/{fileName}
tenants/{tenantId}/report-cards/{reportCardId}.pdf
```

Private files should be served through signed URLs or controlled download endpoints, never by exposing raw object storage paths.
