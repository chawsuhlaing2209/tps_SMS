# Frontend Delivery Plan

This document is the explicit frontend track for the SMS platform. The product
requirements plan names the frontend stack but does not break frontend work into
its own deliverable milestones, screen inventory, or conventions. This file fills
that gap. It is the source of truth for *how* the web app is built; the
requirements plan remains the source of truth for *what* each module must do.

> Scope note: The backend/API has progressed faster than the UI. The web app
> currently exists as a working but hand-rolled scaffold (custom CSS, a bespoke
> data hook, `useState` forms). This plan describes how we align it to the
> intended stack and grow it module by module.

## 1. Stack and responsibilities

| Concern | Choice | Status |
| --- | --- | --- |
| Framework | Next.js (App Router) + React + TypeScript | In use |
| Server state / data fetching | TanStack Query | Wired in (this pass) |
| Tables | TanStack Table | Reusable `DataTable` (this pass) |
| Forms | React Hook Form + Zod (schemas shared from `@sms/shared`) | Wired in (this pass) |
| Internationalization | `next-intl` (Burmese + English) | Wired in (this pass) |
| Styling | Tailwind CSS + shadcn/ui | Planned migration (token-based CSS today) |
| Auth/session | httpOnly cookie + lightweight client session mirror | In use |

The frontend is a thin, workflow-focused client over the REST API. It owns
navigation, forms, validation feedback, tables, dashboards, exports, and
role-specific views. It does not own business rules — those live in the API.

## 2. Architecture conventions

- **Same-origin API proxy.** The browser always calls `/api/*` on the Next.js
  origin; `next.config.ts` rewrites to the API service. No CORS in the browser.
- **Server state via TanStack Query.** All reads use `useApiQuery`; all writes
  use `useApiMutation`, which invalidates affected query keys. No ad-hoc
  `useEffect` + `fetch`.
- **Query keys** are arrays: `["tenant", tenantId, ...resourcePath]`. This makes
  tenant-scoped cache invalidation predictable.
- **Validation is shared.** Zod schemas live in `@sms/shared` where the API and
  web can both import them. Forms use React Hook Form with a Zod resolver so the
  same rules validate client-side and server-side.
- **i18n by key.** No hard-coded user-facing strings in components. All copy goes
  through `next-intl` message catalogs (`messages/en.json`, `messages/my.json`).
  Locale is stored in a cookie and applied app-wide (no locale in the URL).
- **Role-aware UI.** Navigation and actions are gated by the permissions the API
  returns for the session. The UI hides what a role cannot do, but the API stays
  the real authority.

## 3. Screen inventory

### Shipped (scaffold, being upgraded)
- **Sign in** (`/`) — tenant + identifier + password.
- **Dashboard overview** (`/dashboard`) — config counts + recent activity.
- **Academic setup** (`/dashboard/academics/*`) — years, grades, sections,
  subjects (list + quick add).
- **People** (`/dashboard/people`) — users and roles.
- **Audit log** (`/dashboard/audit`) — sensitive-change events.

### Next (MVP 1 completion)
- **Tenant onboarding / settings** — branding, language, timezone, currency.
- **User invite + role assignment** workflow (not just a read-only list).
- **Password reset** request + confirm screens (API already supports this).
- **Empty / error / loading** states standardized via shared components.

### Later (mapped to MVP phases in the requirements plan)
- MVP 2: Admissions (enquiries, leads, enrollment), student profiles.
- MVP 3: Attendance, timetable, exams/grading entry.
- MVP 4: Fees, invoices, payment evidence capture, receipts (PDF).
- MVP 5: HR/payroll, reporting dashboards, parent/student portals (flagged).

## 4. Component layers

1. **Primitives** — buttons, inputs, badges, table, panel, dialog. Today these
   are token-based CSS classes; the migration target is shadcn/ui components on
   Tailwind, reusing the existing design tokens as the Tailwind theme.
2. **Patterns** — `DataTable` (TanStack Table), `QuickAdd`/entity forms (RHF +
   Zod), list states (`loading`/`error`/`empty`), page header.
3. **Feature views** — per-module pages composed from patterns.

## 5. Internationalization (Burmese / English)

Burmese-first UI is a core differentiator in the requirements plan. Rules:

- Every string renders through `useTranslations`. Catalogs are namespaced by area
  (`common`, `auth`, `nav`, `academics`, ...).
- Locale persists in a `locale` cookie; a switcher in the top bar toggles
  `en` ⇄ `my` and refreshes server components.
- Dates, numbers, and currency use the active locale's formatters.
- Document/report templates (receipts, report cards) will reuse the same message
  keys server-side when PDF generation lands.

## 6. Milestones

- **M0 — Stack alignment (this pass):** TanStack Query data layer, RHF + Zod
  forms, reusable TanStack Table, next-intl with EN/MY. Build stays green.
- **M1 — Design system migration:** introduce Tailwind + shadcn/ui, port the
  current design tokens into the Tailwind theme, replace bespoke CSS class names
  with components. Mechanical but large; done as a focused pass to avoid
  regressions.
- **M2 — MVP 1 completion screens:** onboarding/settings, full user+role
  management, password reset screens, standardized states.
- **M3+ — Module rollout:** build admissions, academics operations, finance, and
  HR views in lockstep with the corresponding backend MVP phases.

## 7. Definition of done (per screen)

- Reads via `useApiQuery`, writes via `useApiMutation` with cache invalidation.
- All copy is translated (EN + MY) — no literal strings in JSX.
- Form inputs validated with a shared Zod schema; inline field errors.
- Loading, empty, and error states handled.
- Actions gated by the session's permissions.
- Type-checks and builds clean.
