# Staging → Production Playbook (plain-language)

This is the non-engineer guide to running tps_SMS in the real world: what
staging and production are, how a feature travels from your laptop to paying
schools, why customer data is never at risk from a deploy, and how to manage
the git repository. The technical companion is [operations.md](./operations.md);
the per-release checklists Claude and you must run live in
[DEPLOYMENT.md](../DEPLOYMENT.md).

---

## 1. The three environments (the restaurant analogy)

Think of the platform as a restaurant:

| Environment | What it is | Analogy |
|---|---|---|
| **Local** (your laptop) | Where features are built and changed freely. Database is throwaway demo data (`db:reset` anytime). | The test kitchen |
| **Staging** | A real server on the internet, running the *same code and setup* as production, but with **demo data only**. This is where you click through new features before customers see them. | The dress rehearsal — full menu, no paying guests |
| **Production** | The real thing. Real schools, real students, real payments. **Data here is sacred.** | The dining room during service |

Key idea: **all three run the exact same code**. The only differences are the
`.env` settings — which database they talk to, which email provider, which
domain. Staging exists so that "it worked on my laptop" is never the last test
before customers.

---

## 2. Why a deploy can never delete customer data (if we follow the rules)

This is the most important concept, so here it is plainly:

**The code and the data live in completely different places.**

- Code lives in **git** and on the server's disk. A deploy replaces the code.
- Customer data lives in the **PostgreSQL database** (and uploaded files in
  S3/MinIO). A deploy does not touch it — the new code simply connects to the
  same database the old code was using.

The one bridge between them is **migrations** (`apps/api/drizzle/*.sql`).
A migration is a small, numbered script like *"add a `motto` column to the
tenant_settings table"*. When we deploy a new feature:

1. `npm run db:migrate` runs on the server.
2. It checks which numbered scripts have already been applied, and applies
   **only the new ones**, in order.
3. Existing rows (students, invoices, payments) are untouched — the table just
   gains a new, empty column that the new feature starts filling in.

So adding features later = ship new code + new *additive* migrations. Nothing
is re-created, nothing is wiped.

### The rules that keep this true

1. **Migrations only add; they never destroy in the same release.**
   Add columns as nullable or with defaults. Never `DROP` or rename a column
   in the same release that stops using it — remove it one or two releases
   later, once the old code is gone everywhere ("expand, then contract").
2. **Never run `db:seed`, `db:reset`, or `db:restore` against production.**
   These rebuild demo data and would destroy real data. The scripts now
   *refuse* to run against any non-local database unless you explicitly type
   an override flag (`ALLOW_REMOTE_DB_SEED=1` / `ALLOW_REMOTE_DB_RESTORE=1`) —
   so this cannot happen by accident.
3. **Backup before every production deploy** (`npm run db:backup`), plus the
   automated daily backup. A backup is a full copy of the database you can
   return to. See the schedule in [operations.md](./operations.md).
4. **Every migration is rehearsed on staging first** — ideally against a
   restored copy of the production backup, so you see exactly what production
   will experience.
5. **Watch the migration journal gotcha:** after `drizzle-kit generate`, the
   new entry in `apps/api/drizzle/meta/_journal.json` must get a `when` value
   *higher* than the previous entry (our journal uses normalized values like
   `1783900000010`), or `db:migrate` will silently skip it.

---

## 3. Git: how we manage the repository

Keep it simple — one long-lived branch, short-lived feature branches, and
tags for releases. (This is called "trunk-based development"; it is the least
error-prone model for a small team.)

```
main  ─────●────●────●────●────●────●──▶  always releasable
            \       /      \       /
             feature/       fix/
             school-profile invoice-logo
```

### The rules

1. **`main` is always releasable.** Nothing goes into `main` that you
   wouldn't be willing to put in front of a customer. Protect it on GitHub:
   Settings → Branches → require a pull request + green CI before merging.
2. **Every change is a branch + pull request.** Branch names like
   `feature/staff-profile` or `fix/invoice-logo`. The PR runs CI
   (typecheck + tests) automatically; merge only when green.
3. **Merging to `main` deploys to staging** (automatically, once set up).
   Staging always shows "the next release".
4. **A production release is a tag.** When staging looks good, tag the exact
   commit — `v1.0.0`, then `v1.1.0`, etc. — and deploy *that tag* to
   production. Tags are permanent bookmarks: you always know exactly what
   code production is running, and what to go back to.
5. **Hotfixes** (urgent production bug): branch from the production tag, fix,
   deploy as `v1.1.1`, then merge the same fix back into `main` so it isn't
   lost.

Version numbers, simply: `v MAJOR.MINOR.PATCH` — bump **PATCH** for fixes,
**MINOR** for new features, **MAJOR** for big breaking changes.

---

## 4. The release ritual (checklist)

Every time features move staging → production, follow the same boring steps.
Boring is the goal.

**On staging (days before):**
- [ ] Merge the PRs for the release into `main`; staging updates.
- [ ] Click through each new feature on staging (both EN and Myanmar).
- [ ] Run the migration rehearsal: restore latest production backup onto
      staging (`ALLOW_REMOTE_DB_RESTORE=1 npm run db:restore -- <backup>`),
      run `npm run db:migrate`, confirm the app works with real-shaped data.
- [ ] Check customer-facing documents: invoice, receipt, payslip.

**On production (release day, ideally low-traffic hours):**
- [ ] `npm run db:backup` — fresh backup, verify the file exists.
- [ ] Tag the release: `git tag v1.2.0 && git push origin v1.2.0`.
- [ ] Deploy: pull the tag → `npm ci` → `npm run build` →
      `npm run db:migrate` → restart API, worker, then web (migrations always
      run **before** the new code starts).
- [ ] Smoke test: log in, open dashboard, open an invoice, record a test
      payment on an internal tenant, check `GET /health`.
- [ ] Watch for ~30 minutes (errors, worker queue, user reports).

**If something is wrong (rollback):**
- Code problem → redeploy the previous tag (e.g. `v1.1.0`). Because
  migrations are additive, old code runs fine against the new schema.
- Data problem (rare, means a rule above was broken) → restore the
  pre-deploy backup during a maintenance window.

---

## 5. When testing happens (every stage, different kinds)

Testing is not one event before launch — it is a series of filters. Each
layer catches what the previous one is cheapest to catch, and **the later a
bug is found, the more expensive it is**: a unit-test catch costs 2 minutes,
a staging catch costs a day, a production catch costs a customer's trust.

| Stage | Kind of testing | Who/what does it |
|---|---|---|
| **Development** (laptop) | Automated tests (`npm run test`) + typecheck + the developer clicking through their own feature locally | Developer, continuously |
| **Every pull request** | CI re-runs typecheck + all tests; red = cannot merge | The robot (GitHub Actions), automatically |
| **Staging** | Human, realistic testing: feel, translations, printed documents, regression ("did the new thing break an old thing?"), migration rehearsal against a production-backup copy, usability sessions with a pilot school | You / product, before each release |
| **Production** | Smoke test only — 5 minutes confirming the deploy went cleanly (login, invoice, test payment, `GET /health`) | Whoever deploys, after each release |

Notes:

- The **tenant-isolation test** (`apps/api/src/db/tenant-isolation.test.ts`)
  is the single most important automated test in a multi-school SaaS — it
  proves one school can never see another school's data. It must always run
  in CI and never be skipped.
- Automated tests check *logic*; staging checks *reality*. Neither replaces
  the other.
- **Feedback rule:** if you *discover* a bug on staging, don't just fix it —
  add an automated test for it at the development layer, so that exact bug
  can never travel that far again. Staging surprises should get rarer over
  time; if they don't, layer 1 is too thin.
- The concrete pre-staging plan — coverage inventory, prioritized unit tests
  to add, and the full manual feature checklist — lives in
  [localhost-test-plan.md](./localhost-test-plan.md).

---

## 6. Shipping features gradually (feature flags)

The platform already has per-tenant **feature flags** (`feature_flags` table,
`packages/shared/src/modules.ts`). Use them for anything risky:

1. Ship the feature to production **switched off**.
2. Turn it on for your own internal/demo tenant first.
3. Turn it on for one friendly school, then everyone.

This separates *deploying code* (an engineering act) from *launching a
feature* (a product decision you control per school).

---

## 7. What staging needs (one-time setup)

- A small server or hosting platform (Render / Fly.io / Railway are the
  low-maintenance options; a single VPS with Docker Compose also works),
  running the API, web, worker.
- Its **own** PostgreSQL, Redis, and S3 bucket — never shared with
  production.
- Its own `.env` from `.env.staging.example`: different `SESSION_SECRET`,
  test email addresses, staging domain (e.g. `staging.yourdomain.com`).
- Seed it once with demo tenants (`ALLOW_REMOTE_DB_SEED=1 npm run db:seed`).
- Optional but recommended: password-protect it or keep the URL private —
  it's a rehearsal space, not a public demo.

Production is the same shape, plus: managed/backed-up PostgreSQL, the real
email provider with SPF/DKIM, daily backup cron, and uptime monitoring on
`GET /health`.

---

## 8. The "never" list

- Never run `db:seed` / `db:reset` / `db:restore` against production.
  (The scripts refuse; do not override the guard on production. Ever.)
- Never edit the production database by hand to "quickly fix" something —
  fix it through the app or a reviewed migration.
- Never commit secrets (`.env` values) to git.
- Never deploy code to production that skipped staging.
- Never `DROP`/rename a column in the same release that stops using it.
- Never force-push to `main`.

---

## 9. Glossary

| Term | Meaning |
|---|---|
| **Deploy** | Putting a new version of the code on a server |
| **Migration** | A numbered script that changes the database's *shape* (tables/columns), not its contents |
| **CI** | The robot (GitHub Actions) that runs typecheck + tests on every PR |
| **Tag / release** | A permanent named bookmark of the exact code running in production |
| **Rollback** | Returning production to the previous tag when a release misbehaves |
| **Backup / restore** | A full copy of the database / loading that copy back |
| **Feature flag** | A per-school on/off switch for a feature, independent of deploys |
| **Smoke test** | A 5-minute click-through of the critical paths right after a deploy |
