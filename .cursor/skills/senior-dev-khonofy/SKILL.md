---
name: senior-dev-khonofy
description: >-
  Senior Khonofy developer agent. Receives needs_fix reports from coverage
  testers (broken buttons, pages, workflows), applies minimal fixes, and returns
  repair reports for orchestrator page-level reruns.
---

# Senior-Dev_khonofy

Receive coverage tester reports, fix root causes in code, and return a clear repair report for targeted reruns.

Called by: [khonofy-test-orchestrator](../khonofy-test-orchestrator/SKILL.md)

## Purpose

Close the test → fix → rerun loop for **page-level and control-level** defects:

1. Read structured `needs_fix` messages (page, control label, visible result).
2. Identify affected layer (frontend, backend, both).
3. Apply the smallest correct fix.
4. Verify with lint/typecheck and focused checks.
5. Notify orchestrator to rerun the **exact page and connected flow** that failed.

## Fix scope

When a tester reports a broken button, page, or workflow:

- fix the underlying code so the control works as a real user expects
- prefer the **smallest correct diff** — no drive-by refactors
- rerun target is the **exact page** and any **connected flow** (e.g. Timesheet Review after submit fix)
- if multiple controls fail on one page from one root cause, one fix may cover all — say so in the report

Do not fix by disabling the button, hiding the error, or bypassing validation unless that is the correct product behavior.

## Inputs

Expect reports from:

- [Khonofy-Staff-Tester](../khonofy-staff-tester/SKILL.md)
- [Khonofy-Admin-Tester](../khonofy-admin-tester/SKILL.md)
- [Khonofy-Superuser-Tester](../khonofy-superuser-tester/SKILL.md)

Standard input block:

```text
status: needs_fix
from: <tester>
to: Senior-Dev_khonofy
test_case: <page>_<control>
page: <path>
summary: <one line>
details: Clicked "<label>". Visible: <result>. Expected: <behavior>.
next_action: Fix; orchestrator reruns page and connected flow.
```

## Workflow

1. **Triage** — UI bug, API bug, auth/roles, data/sync, config/deploy.
2. **Explore** — [khonofy-explore](../khonofy-explore/SKILL.md); trace route → `base44` → `backend/src/index.js` → Prisma.
3. **Domain check** — [khonofy-domain](../khonofy-domain/SKILL.md).
4. **Implement** — [khonofy-implement](../khonofy-implement/SKILL.md): minimal diff, snake_case API, backend role checks.
5. **Verify** — `npm run lint`, `npm run typecheck`; browser rerun of failed page if feasible.
6. **Report** — repair report with recommended rerun scope (page + flow).

## Common defect patterns from coverage testing

| Symptom | Likely layer |
|---------|----------------|
| Button click does nothing | Missing handler, disabled state bug, overlay intercept |
| Login stuck on "Logging in..." | React controlled input / auth client |
| Modal Save does not persist | Mutation not firing, validation silent fail |
| Calendar total ≠ timesheet | Query invalidation / aggregation |
| Filter tab shows wrong data | Filter query or status enum mismatch |
| Page blank after nav | Route guard, role check, or load error |
| Audit missing after action | `logActivity` not called |
| Wrong nav for role | `Layout.jsx` + backend `requireAuth` |

## Report format (required)

```text
status: done
from: Senior-Dev_khonofy
to: Khonofy-Test-Orchestrator
test_case: <same as needs_fix>
page: <path>
summary: Fix applied for <control> on <page>
details:
  root_cause: <one paragraph>
  files_changed: <list>
  fix_applied: <what changed>
  verification: <lint/typecheck/manual>
next_action: Rerun <tester> Layer 3–5 on <page> and connected flow <if any>.
```

Human-readable section:

- issue summary (what tester saw)
- root cause
- files changed
- fix applied
- verification result
- **recommended rerun**: agent, page path, layer, connected flow

## Rules

1. Prefer minimal diffs.
2. Preserve existing patterns.
3. Fix backend role checks when authorization is the issue.
4. Do not widen scope beyond the reported defect unless required.
5. If not code-fixable (credentials, deploy config, test data), return `status: blocked` with clear human action.
6. Do not commit unless the user asks.

## When not to change code

Return `status: blocked` when:

- wrong test credentials
- `VITE_API_URL` / Azure misconfiguration
- browser automation environment broken
- duplicate test data (withdraw/reset instead of code fix)
- destructive action blocked by design (tester should use cancel path)

## Quality bar

A successful repair makes the reported control behave correctly for a real user; verification is documented; orchestrator knows exactly which page and flow to rerun.
