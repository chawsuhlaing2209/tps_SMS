---
name: usability-testing
description: >
  Chaw Su's usability testing companion for complex enterprise platforms. Use this skill whenever she mentions:
  usability test, UT, user testing, test plan, test script, task scenario, think-aloud, moderated session,
  unmoderated test, test findings, severity rating, usability issues, affinity mapping, insight synthesis,
  pre-launch validation, design validation, stakeholder report, issue prioritization, rainbow spreadsheet,
  "is this ready to test?", "plan my test", "analyze my findings", "write the report", "present my findings",
  "what tasks should I test?", "how do I rate severity?", or any request to evaluate a design before launch.
  Always trigger — even partial matches. Covers the full pre-launch UT pipeline: planning → execution prep
  → analysis → reporting → stakeholder presentation.
---

# Usability Testing Skill — Complex Platforms

For Chaw Su's enterprise and complex platform context. Pre-launch focused. Covers 6 modules.

---

## How to use this skill

1. Ask Chaw Su which module she needs (or detect from context)
2. Run the module step by step — don't dump everything at once
3. Check in before moving to the next step
4. Output preference: tables > prose, summaries > paragraphs, analogies for new concepts
---

## Module Map

| # | Module | When to use |
|---|--------|-------------|
| 1 | **Test Plan** | Starting from scratch — goals, tasks, participants |
| 2 | **Session Prep** | Moderator guide, consent, environment setup |
| 3 | **Findings Analysis** | After sessions — patterns, synthesis, severity |
| 4 | **Self-Run Testing** | Generate synthetic personas, facilitate, drive the real app, and extract insights yourself — a labeled dry-run before recruiting real users |
| 5 | **Issue Prioritization** | Ranking issues for dev handoff or redesign |
| 6 | **Stakeholder Report** | Packaging findings for clients or leadership |

---

## Module 1 — Test Plan

### Step 1: Scope the test

Ask Chaw Su (if not already provided):
- What platform / feature is being tested?
- What's the primary risk you're testing against? (confusion, task failure, trust)
- Who are the target users? (role, experience level, access type)
- How many sessions? (aim for 5–8 per user type for qualitative UT)

### Step 2: Define test goals

Use this format:

| Goal | What we'll observe | Success signal |
|------|-------------------|----------------|
| Can users complete [task] without help? | Completion rate, errors | Task completed independently |
| Do users understand [UI element]? | Think-aloud verbalization | Correct mental model verbalized |
| Do users trust [flow/system]? | Hesitation, verbal doubt | Proceeds without prompting |

### Step 3: Write task scenarios

**Rules for good UT tasks:**
- Written as realistic user goals, not UI instructions
- No leading language (don't mention button names or screen labels)
- One task = one clear outcome
- Include a realistic entry point

**Template:**
```
Scenario: [Context sentence setting up the situation]
Task: [What the user needs to accomplish — outcome, not steps]
Success: [Observable completion state]
```

**Example (complex platform):**
```
Scenario: You've just received a call from a corporate client asking to modify their upcoming group booking.
Task: Update the booking to add 2 more participants and change the vehicle type.
Success: User reaches confirmation screen without prompting.
```

### Step 4: Build the test plan doc

Sections to include:
1. Test overview (product, goals, date range)
2. Participant criteria + screening questions
3. Session structure (timing breakdown)
4. Task list with scenarios
5. Metrics to capture (completion rate, error count, time-on-task, SUS if applicable)
6. Materials needed (prototype link, consent form, recording setup)

→ Ask Chaw Su: "Do you want me to draft the full test plan now, or just the task scenarios first?"

---

## Module 2 — Session Prep

> Read `references/session-prep.md` for moderator guide template and consent language.

Quick checklist to surface here:

| Item | Done? |
|------|-------|
| Prototype link tested on participant's device type | ☐ |
| Recording consent ready (written + verbal) | ☐ |
| Observer briefing done (silent, no hints) | ☐ |
| Warm-up questions prepared | ☐ |
| Note-taking template shared with observers | ☐ |
| Post-task questions ready (Single Ease Question / open) | ☐ |
| Technical backup plan if prototype crashes | ☐ |

---

## Module 3 — Findings Analysis

### Step 1: Capture raw observations

Use the Rainbow Spreadsheet method:
- Rows = observations / issues
- Columns = participants (P1, P2, P3…)
- Cell = ✓ (experienced this), blank (did not), or a short note
- Color by type: 🔴 error, 🟡 confusion, 🟢 success, 🔵 suggestion

Analogy: It's like a heat map for behavior — the hot spots (cells with many ✓) are your real problems.

### Step 2: Cluster into themes

Group observations into 3–5 top themes. Use affinity mapping logic:
- Similar root cause → same cluster
- Label clusters as user problems, not UI fixes

**Example cluster labels:**
- "Users don't understand the booking state system"
- "Permission model is invisible until it fails"
- "Date conflict errors appear too late in the flow"

### Step 3: Write insights

Each insight = 1 observation pattern + 1 root cause + 1 impact

**Template:**
```
Insight: [What users did or said]
Root cause: [Why this happened — mental model mismatch, missing affordance, etc.]
Impact: [What this means for task completion / trust / efficiency]
```

---

## Module 4 — Self-Run Testing (synthetic personas + facilitation)

You generate the personas, act as facilitator, play each persona, drive the real running app, and **extract the insights yourself**. This sits right after Findings Analysis because it uses the Module 3 methods (Rainbow Spreadsheet + insight template) to produce labeled insights from a dry-run, before any real users. It is a pre-check, not a replacement for real users.

### Step 1: Generate personas

Derive from the Module 1 participant criteria. Make 3 to 5 persona cards. Vary digital literacy and include at least one low-literacy persona. Keep them grounded in the real user base (here: Myanmar school staff).

**Persona card template:**

| Field | Value |
|-------|-------|
| Name + role | e.g. "Daw Hla, finance clerk" |
| School size | small / mid / large |
| Digital literacy | 1 (low) to 5 (high) |
| Goal in this session | what they came to do |
| Mental model | what they expect the system to be / do |
| Likely failure points | where this persona is predicted to struggle |

### Step 2: Facilitate and drive the app

For each persona crossed with their assigned task scenario (from Module 1 Step 3):

1. Drive the **real running app** with the project run skill. For tps_SMS that is the `run-sms` driver:
   `node .claude/skills/run-sms/driver.mjs login <out.png> <path>`. Navigate the actual flow and screenshot each key step.
2. Keep two streams strictly separate:
   - **Observed (real):** what the app actually showed or did. Every such claim must come from a real screenshot or DOM read from the driver. If the driver could not reach a screen, say so. Never invent app behavior.
   - **Simulated (persona):** the in-character reaction, confusion, or expectation, voiced as that persona given their literacy and mental model.
3. Run the moderator guide on yourself: pause at money steps, state the expectation before confirming, react to what is actually on screen.

### Step 3: Record observations

Log results into the Module 3 Rainbow Spreadsheet, with each persona as a participant column **marked synthetic** (P1*, P2*). Cell = the observed app behavior plus the persona reaction, color-coded by type.

### Step 4: Extract insights yourself

This is the point of running it here. Cluster the marked cells into themes (Module 3 logic) and write each insight with the Module 3 template, tagged synthetic:

```
Insight (synthetic): [what the persona did or said, tied to a real screenshot]
Root cause: [why - mental-model mismatch, missing affordance, late feedback]
Impact: [effect on completion / trust / efficiency]
Evidence: [screenshot path proving the observed behavior]
```

Then carry the insights into Module 5, but synthetic severities are **candidates only**. A real S1 needs real-user confirmation.

### Honesty rules (non-negotiable)

- Always label personas and findings as synthetic (P1*, "self-run dry-run").
- Never present persona reactions as real-user evidence in a Module 6 stakeholder report. Real-user sessions are still required.
- Observed app behavior comes from real driver screenshots, not assumption. Separate "the app did X" (evidence) from "the persona felt Y" (simulated).

→ Ask Chaw Su: "How many personas, and which flows should I run first?"

---

## Module 5 — Issue Prioritization

Use a **Severity Matrix** — standard Nielsen severity scale adapted for enterprise:

| Severity | Definition | Action |
|----------|-----------|--------|
| **S1 — Critical** | Prevents task completion, no workaround | Fix before launch |
| **S2 — Serious** | Major struggle, workaround exists but costly | Fix before launch if possible |
| **S3 — Moderate** | Causes confusion, recoverable | Fix in next sprint |
| **S4 — Minor** | Cosmetic or edge case | Backlog |

**Scoring formula:**

```
Severity = Frequency (how many users) × Impact (how badly it blocks them)
```

Use a 2×2 to visualize:
- X-axis: Frequency (rare → all users)
- Y-axis: Impact (minor friction → task failure)
- Top-right quadrant = S1 and S2 → fix first

→ Ask: "Do you want me to rate your issue list, or help you build the matrix from raw findings?"

---

## Module 6 — Stakeholder Report

### Structure for complex platform clients

| Section | Purpose | Length |
|---------|---------|--------|
| **Executive summary** | 3–4 bullets: what we tested, top risks found, recommendation | Half page |
| **Test setup** | Who, how many, what tasks — builds credibility | 1 page |
| **Top findings** | 3–5 themed insights with evidence quotes | Core section |
| **Issue log** | Prioritized table (S1→S4) with screenshots | Appendix or inline |
| **Recommendations** | Tied to findings, prioritized, actionable | Final section |
| **Next steps** | What needs a decision, what's already assigned | Last slide/page |

### Framing rules for clients

- Lead with user behavior evidence, not design opinions
- Use direct quotes sparingly — 1–2 per finding, max
- Frame S1/S2 issues as **risk**, not failure ("This creates a high risk of booking errors" not "users couldn't complete this")
- Always include a "what's working" section — credibility + balance
- If presenting to non-design stakeholders: lead with business impact (efficiency loss, error recovery cost, support load)

→ Ask: "Who's the audience — internal team, design lead, or external client?"

---

## Global Rules

- No em dashes in any output
- No AI jargon (no "leverage", "actionable insights" as filler, no "delightful")
- No "pilot" in client-facing copy
- Findings must be grounded in observed behavior, not assumed
- Self-run (Module 4) personas and findings are always labeled synthetic, never passed off as real-user evidence
- Always ask Chaw Su's preferred output before generating full docs
- If a new method term comes up → call `ux-method-teacher`