---
name: notion-location
description: Notion parent page and report-page naming for SMS test plans and test-run reports
metadata:
  type: reference
---

Test plans and test-run reports are published as sub-pages under the
**School Management System — Product Requirements** Notion page.

- Parent page id: `37f4b932-359d-8188-bfade65ac189d412` (url https://app.notion.com/p/37f4b932359d8188bfade65ac189d412)
- Report page title scheme: `🧪 Platform Testing Plan & Test-Run Report — YYYY-MM-DD`
- First report created 2026-06-25: https://app.notion.com/p/38a4b932359d8158b02fc20f8b246a50

Use `notion-fetch` on the parent first, then `notion-create-pages` with
`parent.type=page_id`. For follow-up runs, prefer appending to / updating the
existing dated report page rather than duplicating.
