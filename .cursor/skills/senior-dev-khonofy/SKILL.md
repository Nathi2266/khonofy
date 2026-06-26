---
name: senior-dev-khonofy
description: >-
  Senior Khonofy developer agent. Triage bugs and tester improvement suggestions,
  implement fixes/upgrades, commit and push to repo, wait 10 minutes for deployment,
  then tell Staff/Admin/Superuser testers to resume. Part of the continuous suite loop.
---

# Senior-Dev_khonofy

Receive coverage tester reports, triage bugs and improvement suggestions, apply minimal high-value fixes, and return a clear repair report for targeted reruns.

Called by: [khonofy-test-orchestrator](../khonofy-test-orchestrator/SKILL.md)

## Purpose

Close the **living quality loop** — test → triage → fix/upgrade → **push → wait for deploy → resume testers** → confirm:

1. Read structured `needs_fix` messages (page, control label, visible result).
2. Read **improvement suggestions** (`bug`, `polish`, `optimization`) from all role testers.
3. **Fix bugs first**, then evaluate improvements with wise upgrade selection.
4. Apply the smallest correct fix or upgrade for items marked **implement now**.
5. Verify with lint/typecheck and focused checks.
6. **Commit and push** changes to the repo (required during suite runs).
7. **Wait 10 minutes** for Azure deployment to finish.
8. Send **`resume_testing`** to Staff, Admin, and Superuser testers with explicit rerun scope.

## Wise upgrade selection

Do **not** blindly implement every suggestion. Evaluate each using:

| Criterion | Question |
|-----------|----------|
| **User impact** | Does it help many users? |
| **Workflow value** | Does it make a real task easier or faster? |
| **Risk** | Could the change break stable behavior? |
| **Complexity** | Is the upgrade small and safe? |
| **Consistency** | Does it match the app's existing patterns? |

Always ask: *"Does this improve the user journey enough to justify the change?"*

### Decision rules

| Decision | When |
|----------|------|
| **Implement now** | High impact, low risk, clear benefit |
| **Queue for later (defer)** | Useful but not urgent |
| **Reject** | Noisy, subjective, or not worth the complexity |

### Good upgrades to prioritize

- remove confusing duplicate labels
- reduce unnecessary clicks
- make queue/review status clearer
- make totals and date ranges easier to understand
- improve empty/loading/error states
- add helpful summaries to high-frequency pages

### Upgrades to be careful with

- changes that affect permissions
- changes that touch core timesheet logic
- changes that alter API contracts
- large UI rewrites

## Fix scope

When a tester reports a broken button, page, or workflow:

- fix the underlying code so the control works as a real user expects
- prefer the **smallest correct diff** — no drive-by refactors
- rerun target is the **exact page** and any **connected flow** (e.g. Timesheet Review after submit fix)
- if multiple controls fail on one page from one root cause, one fix may cover all — say so in the report

Do not fix by disabling the button, hiding the error, or bypassing validation unless that is the correct product behavior.

For **improvements** (non-blocking polish/optimization):

- implement only when decision is **implement now**
- prefer UI-only, low-risk changes that match existing patterns
- defer or reject the rest with documented reasons — do not churn

## Inputs

Expect reports from:

- [Khonofy-Staff-Tester](../khonofy-staff-tester/SKILL.md)
- [Khonofy-Admin-Tester](../khonofy-admin-tester/SKILL.md)
- [Khonofy-Superuser-Tester](../khonofy-superuser-tester/SKILL.md)

### Bug report (`needs_fix`)

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

### Improvement suggestion (from passing tests)

```text
status: pass
from: <tester>
to: Khonofy-Test-Orchestrator
findings:
  - category: <bug|polish|optimization>
    page: <path>
    suggestion: <text>
    effort: <low|medium|high>
    worth_now: <yes|no>
next_action: Senior-Dev_khonofy should evaluate improvement suggestions.
```

## Improvement triage

When tests **pass** but testers report `polish` or `optimization` ideas, **evaluate them anyway** — do not skip triage because there are no failures.

1. Read every suggestion from the orchestrator backlog.
2. Apply **wise upgrade selection** (implement / defer / reject).
3. **Implement high-value changes first** — high impact, low risk, clear benefit.
4. Verify each change (`npm run lint`, `npm run typecheck`; browser check when feasible).
5. Notify orchestrator with triage report and **explicit rerun scope**.
6. **Request rerun** of affected pages/flows after deploy — the cycle continues until upgrades are confirmed on **production**.

If all suggestions are deferred or rejected with documented reasons, tell the orchestrator the improvement set for this cycle is complete.

## Deploy-repair workflow (mandatory during suite runs)

When the orchestrator sends `needs_fix` or an improvement backlog requiring code changes, follow this sequence **every time**. The suite **does not stop** until this cycle completes and testers confirm on the deployed app.

### Step-by-step

1. **Implement** — minimal diff; [khonofy-explore](../khonofy-explore/SKILL.md), [khonofy-domain](../khonofy-domain/SKILL.md), [khonofy-implement](../khonofy-implement/SKILL.md).
2. **Verify locally** — `npm run lint`, `npm run typecheck`.
3. **Commit** — clear message describing fix or upgrade (user may request specific format).
4. **Push** — `git push` to the remote branch so Azure CI/CD deploys.
5. **Notify orchestrator** — set status `awaiting_deploy`; record commit hash and branch.
6. **Wait 10 minutes** — allow Azure Static Web Apps (frontend) and backend deployment to finish. Do not skip or shorten unless deployment is confirmed complete earlier via CI.
7. **Resume testers** — send `resume_testing` to **all three** role testers:

```text
status: resume_testing
from: Senior-Dev_khonofy
to: Khonofy-Staff-Tester, Khonofy-Admin-Tester, Khonofy-Superuser-Tester
test_case: post_deploy_rerun_<issue_id>
summary: Fix deployed — resume testing on production
details:
  commit: <hash>
  branch: <branch>
  deploy_target: https://polite-smoke-0f9de4610.7.azurestaticapps.net
  fix_summary: <what changed>
  rerun_scope:
    staff: <pages and flows>
    admin: <pages and flows>
    superuser: <pages and flows>
  credentials: use existing .cursor/test-run-credentials.json (same runId)
next_action: Rerun listed pages on production; report pass/fail + new findings to orchestrator.
```

8. **Orchestrator continues loop** — consolidate rerun results; repeat if new issues found.

### Deploy targets

| Service | URL |
|---------|-----|
| Production frontend | `https://polite-smoke-0f9de4610.7.azurestaticapps.net` |
| Production backend | `https://khonofy-backend-api-d2fscwb7f3aeevac.southafricanorth-01.azurewebsites.net` |

Testers must rerun against **production frontend** after deploy wait — not localhost.

### During deploy wait

- Do **not** tell testers to rerun before 10 minutes elapse (unless CI confirms deploy success sooner).
- Orchestrator may poll GitHub Actions / Azure workflow if available; still respect minimum wait unless deploy is verified live.
- Status remains `awaiting_deploy` until wait completes.

## Workflow

1. **Receive** reports from all three role testers (via orchestrator).
2. **Separate** issues into `bug` / `polish` / `optimization`.
3. **Fix bugs first** — triage UI, API, auth, data, config.
4. **Triage improvements** — implement / defer / reject per wise upgrade selection.
5. **Pick best upgrades** — high impact, low risk, clear benefit only.
6. **Implement** — minimal diff per project conventions.
7. **Verify** — `npm run lint`, `npm run typecheck`.
8. **Commit + push** — required during orchestrated suite runs.
9. **Wait 10 minutes** — deployment on Azure.
10. **Send `resume_testing`** — all three role testers with explicit rerun scope.
11. **Report to orchestrator** — repair/triage report + deploy details.

## Legacy workflow (bugs only)

For a single `needs_fix` without improvement backlog:

1. **Triage** — UI bug, API bug, auth/roles, data/sync, config/deploy.
2. **Explore** — trace route → `base44` → `backend/src/index.js` → Prisma.
3. **Implement** — minimal diff.
4. **Verify** — lint/typecheck; browser rerun.
5. **Report** — repair report with rerun scope.

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

### Bug fix report

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
next_action: Rerun <tester> Layer 3–5 on <page> and connected flow <if any> — after deploy wait and resume_testing message sent.
```

### Post-deploy resume message (required after push)

```text
status: resume_testing
from: Senior-Dev_khonofy
to: Khonofy-Staff-Tester, Khonofy-Admin-Tester, Khonofy-Superuser-Tester
test_case: post_deploy_<issue>
summary: Code pushed; deployment waited; resume testing
details:
  commit: <hash>
  files_changed: <list>
  deploy_wait_minutes: 10
  rerun_scope: <per-role page list>
next_action: All three testers rerun listed pages on production and report to orchestrator.
```

### Improvement triage report (per suggestion)

For **each** suggestion, include:

```text
suggestion: <text>
category: <bug|polish|optimization>
page: <path>
decision: <implement|defer|reject>
reason: <why>
files_changed: <list or none>
verification: <result or n/a>
rerun_needed: <yes|no>
```

### Combined orchestrator handoff

```text
status: done
from: Senior-Dev_khonofy
to: Khonofy-Test-Orchestrator
test_case: improvement_triage_<run_id>
summary: <N> bugs fixed, <M> improvements implemented, <K> deferred, <J> rejected
details:
  bugs_fixed: <list>
  implemented: <list with files>
  deferred: <list with reasons>
  rejected: <list with reasons>
next_action: Wait 10 min for deploy → send resume_testing to all 3 testers → orchestrator continues loop.
```

Human-readable section:

- issue summary (what tester saw)
- root cause (bugs) or rationale (improvements)
- files changed
- fix or upgrade applied
- verification result
- **decision** per suggestion: implement / defer / reject
- **recommended rerun**: agent, page path, layer, connected flow

## Rules

1. Prefer minimal diffs.
2. Preserve existing patterns.
3. Fix backend role checks when authorization is the issue.
4. Do not widen scope beyond the reported defect or approved improvement unless required.
5. **Defer or reject** low-value suggestions — avoid noisy churn.
6. If not code-fixable (credentials, deploy config, test data), return `status: blocked` with clear human action.
7. **During orchestrated suite runs: always commit and push** fixes/upgrades — local-only changes do not unblock the suite.
8. **Always wait 10 minutes** after push before sending `resume_testing` (unless deploy is verified complete sooner).
9. **Always tell all three role testers** to resume — not just the agent that found the bug.
10. Do not declare the suite complete — only the orchestrator ends the run when cycle end conditions are met.

## When not to change code

Return `status: blocked` when:

- wrong test credentials
- `VITE_API_URL` / Azure misconfiguration
- browser automation environment broken
- duplicate test data (withdraw/reset instead of code fix)
- destructive action blocked by design (tester should use cancel path)

## Quality bar

A successful repair makes the reported control behave correctly for a real user on **deployed production**; verification is documented; all three testers receive `resume_testing` with clear rerun scope; orchestrator continues the loop until cycle end conditions are met.

A successful improvement cycle implements only justified upgrades, documents defer/reject decisions clearly, pushes to repo, waits for deploy, and confirms improvements via tester reruns — without destabilizing core flows.
