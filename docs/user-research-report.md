# User Research Report — tps_SMS

**Prepared by:** User Research Review Agent
**Date:** 2026-06-19
**Method:** Heuristic evaluation (Nielsen's 10) against the implemented codebase + bilingual translation audit
**Scope reviewed:** `apps/web` (UI/pages/components), `apps/api/src` (enrollment, finance, attendance, audit), `apps/web/messages/{en,my}.json`, `packages/shared/src/roles.ts`, design system CSS.

> **Critical caveat up front:** No participant research exists yet — no recordings, transcripts, surveys, usability sessions, interviews, card sorts, or analytics. **Zero behavioral or attitudinal data from real Myanmar school users has been collected.** Everything below is an *expert heuristic inspection of the build*, not evidence of what users actually do. Heuristic evaluation surfaces likely problems; it cannot measure task success, confirm severity in the field, or substitute for testing with admins, finance staff, teachers, and parents. Treat every "Confidence" rating accordingly: it reflects confidence in the *code observation*, not in the *user impact*.

---

## 1. Executive Summary

- **The flagship unified enrollment + billing ceremony is well-engineered and heuristically strong.** It is a true single 4-step ceremony (`placement → fees → discounts → invoice preview`) with an atomic, transactional confirm, automatic sibling-discount surfacing, confirm-blockers, permission guards, and a three-event audit trail (`enrollment.confirm`, `invoice.create`, `payment.record`). The product's core bet is implemented as designed, not as the rejected separated flow. **(High confidence in implementation; user-mental-model fit is UNTESTED.)**

- **Localization is the single biggest risk and is materially incomplete.** Key parity is perfect (1848/1848 keys, no missing keys either direction), but **~614 strings (33%) in `my.json` are byte-identical to English**, and **379 strings mix Burmese + English ("Banglish")**. The damage concentrates exactly where it hurts most: the money-critical enrollment totals (`enrollments.totalDue`, `subtotal`, `discountTotal`, `confirmEnrollment`) are **100% untranslated English**, and finance terms leak (`finance.recordPayment` = "Payment မှတ်မည်"). For a Burmese-first finance/parent audience this is a trust-and-comprehension defect on the highest-stakes screens.

- **Backend error messages are hardcoded English and bypass i18n entirely.** Every `BadRequestException`/`ConflictException` in `finance.service.ts` and `enrollment-billing.service.ts` ("This invoice is closed — no further payments can be recorded.", "Payment amount exceeds remaining balance (…)") reaches the Burmese UI in English. Heuristic #9 (help users recover from errors) fails in Burmese on money operations.

- **Two major Information Architecture gaps for the two most time-poor/non-technical personas.** (1) **Attendance has a full backend but no top-level nav item** — it is buried three levels deep as a tab under `structure/rooms/[classroomId]`, hostile to the mobile, between-classes Teacher. (2) The Finance area splits cashiering ("Billing"), invoices, and payments confusingly, and there is **no unified per-student AR statement**; the receivables report is a raw `JSON.stringify` dump.

- **No parent/guardian or student-facing experience exists.** `parent_guardian` and `student` roles are defined with permissions in `roles.ts`, but every route lives under staff `/dashboard`. Guardians exist only as records managed by staff (`people/`). The lowest-digital-literacy, Burmese-first, mobile-first persona has **zero coverage** — in the product and in research.

- **Money formatting is inconsistent and partly omits the currency unit.** Tables/receipts use `toLocaleString("en-US")` with no MMK suffix; fee structures append "MMK"; the payment modal puts MMK only in the field label. Western thousands separators are used throughout with no Myanmar-numeral option. Currency comprehension for Burmese finance staff is **unverified**.

- **Strongest single action:** Commission a **moderated, Burmese-language usability study of the enrollment+billing ceremony and the payment-recording flow** with real registrars and finance staff, on the **Burmese UI**, on **mobile**. This is the highest-leverage gap: the flagship flow has never been observed with a real user, in the real language, on the real device.

- **Overall research-quality verdict: NOT YET ASSESSABLE as a body of research — because no user research exists.** This report is a heuristic baseline. Confidence that the *product is usable by Myanmar school staff* is **Low**, purely from absence of evidence, not from observed failure.

---

## 2. Artifact & Method Assessment

Only one method was available to apply: heuristic evaluation against the build. There are **no participant artifacts** to review.

### Method: Heuristic Evaluation (Nielsen's 10) — by the reviewer, against the implemented code

- **Fit for purpose:** *Appropriate* as a first-pass discount-rate inspection to surface likely problems before testing. *Wrong tool* for any claim about real task success, severity in the field, or Burmese-speaker comprehension — those require behavioral data.
- **Methodological strengths:** Grounded in actual implementation (specific files/lines, not mockups); covers the real flagship flow end to end including the API/audit layer; includes a quantified bilingual translation audit (objective key-diff, not impression).
- **Methodological flaws / limits:**
  - **Single evaluator.** Nielsen's own guidance: one evaluator finds ~35% of issues; 3–5 evaluators are needed for good coverage. This inspection will have **missed issues**.
  - **No severity validation.** Severity here is inferred from heuristics + product stakes, not from observed user impact/frequency.
  - **Inspected code, not a running bilingual UI.** Rendering defects (Burmese line-breaking, tone-mark stacking, button overflow, Zawgyi-vs-Unicode font fallback, truncation) **cannot be assessed from source** — they need screenshots/devices.
  - **No real users, no Burmese speakers, no mobile devices** in the loop.
- **Validity verdict:** *Medium* confidence in the **code observations** (e.g., "these strings are untranslated" is objectively true). *Low* confidence in **user-impact severity** until tested.
- **Localization coverage of the evaluation:** *Partial* — translation strings audited objectively; **rendered Burmese UI not assessed at all.**

### Methods with ZERO artifacts (cannot be reviewed; logged as gaps in §7)

Usability testing, interviews, surveys (SUS/UMUX-Lite/SEQ), card sorting, tree testing, contextual inquiry/field studies, diary studies, focus groups, A/B tests, first-click testing, eye-tracking/attention, journey mapping, competitive analysis. **None exist.**

---

## 3. Findings Mapped to Flows

Severity per the brief's rubric. **Frequency** is "n/a (no participants)" throughout — heuristic inspection only. **Confidence** = confidence in the *code observation*, not user impact.

| ID | Issue | Flow | Persona(s) | Severity | Frequency | Confidence | Loc. Flag | Source |
|----|-------|------|-----------|----------|-----------|-----------|-----------|--------|
| F-01 | Enrollment money totals untranslated: `enrollments.totalDue/subtotal/discountTotal/confirmEnrollment` are identical English in `my.json` | Enrollment+billing | Admin, Finance, Parent | **Critical** | n/a | High | **Yes** | `messages/my.json`; enrollment-wizard.tsx L704–717 |
| F-02 | Backend error messages hardcoded English, bypass i18n — shown in Burmese UI on money ops | Finance/AR, Enrollment | Finance, Admin | **Critical** | n/a | High | **Yes** | `finance.service.ts` L1279–1296,1414–1422; `enrollment-billing.service.ts` |
| F-03 | No parent/guardian or student portal; roles exist but no UI; Burmese-first low-literacy persona uncovered | Billing, Grades, Comms | Parent, Student | **Critical** (scope) | n/a | High | **Yes** | `roles.ts` L139; all routes under `/dashboard` |
| F-04 | Attendance has no top-level nav; buried 3 levels deep as a tab under `structure/rooms/[id]` | Attendance | Teacher | **Major** | n/a | High | No | `lib/permissions.ts` DASHBOARD_NAV; `classroom-ops-tabs.tsx` |
| F-05 | ~614/1848 (33%) `my.json` strings untranslated English; 379 mixed Burmese+English | Cross-cutting | All Burmese users | **Major** | n/a | High | **Yes** | translation key-diff |
| F-06 | Currency formatting inconsistent; MMK omitted in tables/receipts; Western numerals only | Finance/AR, Enrollment | Finance, Parent | **Major** | n/a | High | **Yes** | `invoices/page.tsx` L53–61; `fee-structures/page.tsx` L63–65; `record-payment-modal.tsx` |
| F-07 | No unified per-student AR statement (invoices+payments+refunds in one view) | Finance/AR | Finance | **Major** | n/a | Medium | No | finance pages IA; `billing/page.tsx` |
| F-08 | Receivables report is raw `JSON.stringify` dump; no AR aging, no reconciliation, no export | Finance/AR, Reporting | Finance, Head | **Major** | n/a | High | No | `finance/reports/page.tsx` L101 |
| F-09 | No explicit confirm modal before recording a payment; receipt shown post-hoc; double-submit risk | Finance/AR | Finance | **Major** | n/a | Medium | No | `record-payment-modal.tsx` L118–138 |
| F-10 | Confirmed enrollment cannot be reversed/undone in UI (no cancel/void path) | Enrollment+billing | Admin, Finance | **Major** | n/a | Medium | No | `enrollments.service.ts` L240–241 |
| F-11 | AR/outstanding balance NOT surfaced inside enrollment ceremony before confirming | Enrollment+billing | Finance, Admin | **Minor→Major** | n/a | Medium | No | enrollment-wizard.tsx (no arBalance field) |
| F-12 | Sibling-summary message string appears server-built; verify it is translated, not hardcoded EN | Discounts, Enrollment | Admin, Finance | **Minor** | n/a | Medium | **Yes** | discount-evaluation logic; wizard L617–623 |
| F-13 | Early-payment discount only previews after toggling "collect payment" checkbox | Enrollment+billing, Discounts | Admin, Finance | **Minor** | n/a | Medium | No | enrollment-wizard.tsx L725–742 |
| F-14 | Discount list hides eligibility criteria (sibling ordinal, stackability) until "Configure" | Discounts | Finance | **Minor** | n/a | Medium | No | `discounts-workspace.tsx` L165–259 |
| F-15 | IA naming: "Billing" vs "Payments" vs "Invoices" vs "Fee Structures/Items" overlap | Finance/AR | Finance, Admin | **Minor** | n/a | Medium | No | `finance/layout.tsx` |
| F-16 | Label inconsistency: "Balance" vs "Balance Due"; "Collected" vs "Received" | Finance/AR | Finance | **Cosmetic→Minor** | n/a | High | No | billing/invoices/payments pages |
| F-17 | Wizard responsiveness relies on flex only; no wizard-specific breakpoints; touch target sizing unverified | Enrollment+billing | Admin (mobile) | **Minor** | n/a | Low | **Yes** | enrollment-wizard.tsx; globals.css media queries |
| F-18 | Auth/setup error strings mix English tech jargon into Burmese ("npm run dev", "Docker", "tenant") | Onboarding/Auth | Admin | **Minor** | n/a | High | **Yes** | `my.json` auth.*, platformTenants.* |

**Positive findings worth preserving (do not regress):**
- P-01 Atomic transactional confirm with full audit trail (enroll/invoice/payment) — `enrollment-billing.service.ts` L333–505. **Strong.**
- P-02 Sibling/family discount auto-evaluated and surfaced; no recall required — `buildSiblingSummary`. **Strong (Heuristic #6).**
- P-03 Payment refund/void fully audited via `recordSensitiveCorrection` with mandatory reason + before/after — `finance.service.ts` L1403–1456. **Strong.**
- P-04 Single `fullName` field for students/guardians (no first/last split) — correct for Myanmar naming. `schema.ts` L380,400,462. **Strong localization choice.**
- P-05 Loading/pending/disabled states and success toasts consistently wired through mutation hooks. **Good (Heuristic #1).**
- P-06 Confirm-blockers + permission guards prevent confirming with pending discount approvals or without finance permission. **Good (Heuristic #5).**
- P-07 Language switcher (en/my, cookie-persisted) exists in sidebar. **Good.**

---

## 4. Prioritized Issue List

Ordered by severity × stakes. Frequency/confidence are heuristic, so prioritization leans on severity and business risk.

### Quick Wins (high impact, low effort)

1. **F-01 — Translate the enrollment money totals (Critical).**
   - *Observation:* `totalDue`, `subtotal`, `discountTotal`, `confirmEnrollment` are literal English in `my.json`.
   - *Why it matters:* These are the decision-point labels on the flagship flow's confirm screen where money is committed. A Burmese-first registrar/finance user confirming an invoice in English labels is a trust + comprehension failure on the product's core bet.
   - *Fix:* Provide verified Burmese for these specific keys first (e.g., `totalDue → စုစုပေါင်း ပေးရန်`, `subtotal → အကြမ်းဖျင်းပေါင်း`, `discountTotal → လျှော့စျေး`, `confirmEnrollment → စာရင်းသွင်းမှု အတည်ပြုမည်` — back-translate to verify). Then sweep the rest of the `enrollments` namespace (50% untranslated).

2. **F-16 — Standardize finance labels.** Pick one of "Balance"/"Balance Due" and "Collected"/"Received" and apply across billing/invoices/payments. Pure copy edit.

3. **F-08 (partial) — Replace the receivables `JSON.stringify` dump** with a basic formatted table. Even a minimal table beats raw JSON for finance staff.

4. **F-06 — Append "MMK" consistently** by routing all money rendering through one shared formatter (the `fee-structures` `formatMmk` already does the right thing). Low effort, removes ambiguity.

5. **F-18 — Strip dev/tech jargon from user-facing Burmese error strings** (auth/platform "npm run dev", "Docker"). These are developer messages leaking to users.

### Strategic (high impact, higher effort)

6. **F-02 — Internationalize backend error messages (Critical).** Move thrown messages to error codes resolved to Burmese on the client (or a server-side message catalog keyed by locale). Without this, every money-operation failure speaks English to a Burmese cashier. Recovery (Heuristic #9) is broken in the live language.

7. **F-03 — Define the parent/guardian (and student) experience.** Roles exist with no surface. Decide scope: even a read-only, mobile-first, Burmese-first "view invoice / view balance / pay" view for guardians is the persona with the lowest digital literacy and highest count. This is product scope, not just UX.

8. **F-04 — Promote Attendance to top-level navigation.** Add an "Attendance" nav item gated on `attendance.mark`, landing on a class picker → today's roster, optimized for mobile and one-handed marking between classes. Burying daily attendance under `structure/rooms` is hostile to the Teacher persona's core daily task.

9. **F-07 — Build a unified per-student AR statement** (all invoices + payments + refunds + running balance) linked from Billing and the student profile. This is the mental model finance staff have ("what does this family owe and what have they paid?") and currently requires clicking each invoice.

10. **F-09 / F-10 — Add a payment confirmation step and an enrollment reversal path.** A confirm-before-commit on payment recording (with student + amount echoed) reduces wrong-amount/wrong-student risk; an audited cancel/void for confirmed enrollments closes the user-control gap (Heuristic #3) on a flow that is currently one-way.

11. **F-05 — Complete and verify the Burmese localization** with a native finance/education translator and back-translation, prioritizing namespaces by untranslated ratio: `settings` (77%), `discounts` (67%), `team` (84%), `enrollments` (50%), then `finance` money screens.

---

## 5. Localization & Cultural Findings (dedicated)

This is the highest-risk area and the reason overall confidence in real-world usability is Low.

**Quantified translation state (objective key-diff of `en.json` vs `my.json`):**
- Key parity: **1848 / 1848** keys present in both; **0 missing** either direction. (Good structural hygiene.)
- Untranslated (byte-identical to English, contains Latin words): **~614 strings (33%)**.
- Mixed Burmese + English in a single string ("Banglish"): **379 strings**.
- `my.json` values containing Burmese script: **1216 / 1848 (66%)** — i.e., a third has *no* Burmese characters at all.

**Worst-offending namespaces (untranslated ratio):**
`team` 84% · `settings` 77% · `discounts` 67% · `departments` 62% · `guardians` 58% · `academicSetup` 52% · `enrollments` 50% · `households` 46% · `teachers` 44% · `salary` 43% · `platformTenants` 38% · `students` 37% · `classrooms` 36% · `academics` 29% · `finance` 20%.

**Money/enrollment specifics (Critical — these are the stakes):**
- `enrollments.totalDue`, `subtotal`, `discountTotal`, `confirmEnrollment` → **fully English**.
- `finance.title` ("Fees & Billing"), `finance.invoices`, `finance.payments` → **English**.
- `finance.recordPayment` → **"Payment မှတ်မည်"** (English noun + Burmese verb — a clear Banglish defect on a money action).
- Positively, `common.*` action verbs and validation are translated (`save → သိမ်းမည်`, `cancel → မလုပ်တော့ပါ`, `required → ဤအချက်ကို ဖြည့်ရန် လိုအပ်သည်။`, `somethingWrong → တစ်ခုခု မှားယွင်းသွားပါသည်။`).

**Banglish / tech-jargon leakage in onboarding & auth (Minor–Major for trust):**
- `auth.apiUnavailable`, `platformAuth.apiUnavailable` embed **developer instructions** ("Project root မှ npm run dev … Docker လည်း ဖွင့်ထားပါ: npm run db:up။") into a user-facing Burmese error. These should never reach a school admin.
- Pervasive untranslated technical nouns inside Burmese sentences: "tenant", "Sign-in server", "reset token", "paste", "auto-generate", "feature", "Console". Acceptable for platform-internal screens, problematic for school-facing ones.

**Currency & numerals (Major, unverified impact):**
- All amounts rendered with `toLocaleString("en-US")` → **Western digits + comma separators**, e.g., `1,234,567`. No Myanmar-numeral (၁၂၃) option and no locale-aware separator.
- "MMK"/ကျပ် is inconsistently attached (label-only in payment modal; suffix in fee-structures; absent in invoice/billing tables and receipt formatter). Which numeral system and currency placement Burmese finance staff and parents expect on receipts is **untested** and should be a question in field research.

**Names & honorifics (handled well — preserve):**
- Single `fullName` field everywhere (`schema.ts` L380/400/462) correctly avoids the first/last-name trap. Family grouping uses `family_group_id`, not shared surname — correct for Myanmar.
- *Open question for research:* are honorifics (U/Daw/Ko/Ma/Mg) entered into `fullName`, and does sorting/search behave acceptably? Not evidenced.

**Rendering (CANNOT be assessed from source — flagged for testing):**
- Zawgyi-vs-Unicode handling, tone-mark/stacking correctness, Burmese line-breaking, label truncation, button overflow under Burmese text expansion, font fallback. **No screenshots/devices were available.** These are classic Myanmar defects and must be checked on real devices in the Burmese UI.

**Register/politeness:** microcopy tone for parents and money messaging (politeness level) is **not evaluable** from keys alone; flag for focus-group/terminology validation.

---

## 6. Research Quality Scorecard

Scoring the **body of user research that exists**. Because **no participant research exists**, most dimensions are unscoreable (n/a); the heuristic inspection is scored where applicable. Scale 1–5.

| Dimension | Score | One-line justification |
|-----------|-------|------------------------|
| Appropriateness of methods | **1/5** | Only a single-evaluator heuristic pass exists; no behavioral/attitudinal methods at all. |
| Sampling / recruitment | **n/a (0)** | No participants recruited — no admins, finance, teachers, parents, no Burmese speakers. |
| Bias control | **n/a (0)** | No study to control; deference/acquiescence risk for Myanmar context entirely unaddressed. |
| Analytical rigor | **2/5** | Heuristic findings are specific and code-traceable, but single-evaluator and no severity validation. |
| Statistical validity | **n/a (0)** | No quantitative data; no SUS/SEQ; no denominators possible. |
| Localization coverage | **2/5** | Translation strings audited objectively (good), but rendered Burmese UI and native-speaker validation absent. |
| Actionability | **3/5** | Findings map to files/flows and yield concrete fixes, but impact/priority unvalidated by users. |

**Net:** This is a *pre-research baseline*, not a research program. The team is at "step zero" for user evidence.

---

## 7. Gaps & Recommended Next Studies

**Every critical flow and persona is currently untested with real users.** Recommended program, prioritized.

### Untested flows (all of them)
Enrollment+billing ceremony · billing/invoicing · finance/AR & reconciliation · attendance marking & corrections · grades/report-card entry & publication · discounts (incl. sibling) · student/identity & family grouping · onboarding/tenant setup · navigation/IA · dashboards · search · notifications · login/auth.

### Untested personas (all of them)
School Admin/Registrar · Finance/Cashier · Teacher · Head/Principal/Owner · **Parent/Guardian (also no product surface)** · (Student).

### Untested language
**No Burmese-language testing of anything.** No native-speaker terminology validation. No device-level Burmese rendering check.

### Recommended studies (priority order)

1. **Moderated usability test — Enrollment+billing ceremony (Burmese UI, mobile + desktop).** *Why:* flagship flow, never observed; diagnose whether any failure is interaction vs. mental-model-mismatch (users hunting for a separate "create invoice" step) vs. signposting — do **not** pre-judge as a defect. *Objective:* completion, errors, assists, time-to-confirm; comprehension of fee preview, sibling discount, total due. *Sample:* 5–7 registrars + 5–7 finance staff, real Burmese names/MMK/sibling scenarios, scenario-based non-leading tasks ("Ma Hnin, Grade 3, her brother already attends — get her registered and first fees sorted").

2. **Moderated usability test — Payment recording, refund/void, and per-student AR (Burmese UI).** *Why:* highest-stakes money ops; test wrong-student/wrong-amount guards, confirmation expectations (F-09), reversal needs (F-10), AR-statement mental model (F-07). *Sample:* 6–8 finance/cashier staff. *Measures:* error rate on selecting student/invoice; SEQ per task.

3. **Burmese localization & terminology validation (native expert review + small focus groups).** *Why:* close F-01/F-02/F-05/F-06; validate finance/academic terms (invoice vs receipt vs fee vs balance), numeral/currency expectations, honorifics, politeness register. *Method:* professional finance/education translator + back-translation; 1–2 small homogeneous focus groups for terminology resonance (separate finance from admin from parents to avoid deference/hierarchy bias).

4. **Device-level Burmese rendering audit.** *Why:* Zawgyi/Unicode, stacking, truncation, button overflow are invisible in source. *Method:* render every key screen in `my` locale on lower-spec Android + desktop; screenshot review; capture overflow/clipping. Fast, high-value.

5. **Contextual inquiry / field study — front office & finance desk.** *Why:* capture workarounds (paper ledgers, Excel, Viber/Telegram fee reminders, cash handling), connectivity, shared/low-spec devices, interruptions — ecological validity the lab can't give. *Sample:* 3–5 schools, term-start if possible.

6. **Tree test + first-click test on the IA (English + Burmese).** *Why:* validate F-04 (attendance findability), F-15 ("Billing/Payments/Invoices/Fee structures" confusion). *Tasks:* "mark today's attendance for your class", "find what the Aung family still owes", "record a cash payment". *Sample:* tree testing tolerates larger n — aim 20–30/segment.

7. **Teacher mobile attendance + grade-entry usability test (on phone, between-class context).** *Why:* Teacher is mobile, time-poor; attendance is buried and grade entry path is unclear. *Sample:* 5–7 teachers on their own devices.

8. **Diary study across a billing cycle.** *Why:* longitudinal AR-chase and term-start enrollment-surge pain are invisible in one session. *Method:* mobile-first, Burmese entry, 4–6 weeks, finance + admin.

9. **Onboarding / tenant-setup walkthrough.** *Why:* first-run setup (academic year, grades, fee plans, discounts) is the gate to value; untested; many strings here are heavily untranslated. *Method:* 4–6 first-time admins, think-aloud.

10. **Competitive analysis (incl. paper/Excel incumbent and regional SIS).** *Why:* validate the unified-ceremony differentiation thesis with evidence and benchmark Burmese localization quality of alternatives. *Method:* structured framework (flow, IA, localization, mobile).

11. **Benchmark survey with validated instruments (after the flows are testable in Burmese).** SUS or UMUX-Lite + SEQ post-task, **back-translated**, with proper n, response rate, and dispersion reporting — *not* before qualitative testing has fixed the obvious defects.

12. **Parent/guardian discovery (once a surface is decided).** Interviews + concept test, Burmese-first, mobile-first, lowest-literacy assumptions, on fee notifications and payment.

---

## 8. Limitations of This Review

- **No participant research existed to review.** This is a heuristic inspection of the build, not an evaluation of user evidence. It cannot report task success, error rates with denominators, satisfaction, or validated severity. Every severity rating is an expert inference, not a measurement.
- **Single evaluator.** Nielsen's method expects 3–5 evaluators; coverage here is partial and issues were certainly missed.
- **Source-code inspection only — no running app, no rendered Burmese UI, no devices, no screenshots.** All rendering-class localization defects (Zawgyi/Unicode, stacking, truncation, overflow, font fallback) are **flagged but unassessed**.
- **Translation audit is mechanical.** "Identical to English" reliably finds untranslated strings, but does **not** judge the *quality/accuracy* of strings that *are* in Burmese — finance/academic term correctness and politeness register require a native expert (recommended in §7).
- **Frequency is "n/a" everywhere** because there are no sessions; prioritization therefore leans on severity and product stakes and should be re-ranked after testing.
- **Some line numbers are from sub-agent reads** of the same files; treat them as close pointers, not exact citations, and re-verify before acting.
- **The product's core bet (unified ceremony) is deliberately not judged as right or wrong here** — whether users want the separated flow is an empirical question for study #1, not a heuristic conclusion.
- **Assumptions made:** persona definitions and flow list are taken from the agent brief and `CLAUDE.md`; `roles.ts` confirms `parent_guardian`/`student` roles but I assumed absence of a portal from the absence of non-`/dashboard` routes — a portal could be planned/elsewhere and simply not found.

---

*End of report. This document is a heuristic baseline intended to scope and prioritize the real user research program described in §7, not to substitute for it.*
