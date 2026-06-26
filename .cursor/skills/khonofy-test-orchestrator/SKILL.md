---
name: khonofy-test-orchestrator
description: >-
  Coordinates dual-purpose Khonofy browser testing with a continuous deploy-repair
  loop — verify correctness, collect improvements, senior dev implements and
  pushes, wait for deployment, rerun until stable. Suite never stops on pass alone.
---

# Khonofy Test Orchestrator

Primary entry point for coordinated, **coverage-driven** multi-agent testing of Khonofy.

## Purpose

Coordinate three real-user browser testing agents plus a senior developer repair agent:

| Agent skill | Role |
|-------------|------|
| [Khonofy-Staff-Tester](../khonofy-staff-tester/SKILL.md) | All staff-visible pages, controls, and flows |
| [Khonofy-Admin-Tester](../khonofy-admin-tester/SKILL.md) | All admin-visible pages, controls, and handoffs |
| [Khonofy-Superuser-Tester](../khonofy-superuser-tester/SKILL.md) | All superuser pages, audit, and cross-role checks |
| [Khonofy-Test-Provision](../khonofy-test-provision/SKILL.md) | **Step 0** — fresh staff, admin, superuser per run |
| [Senior-Dev_khonofy](../senior-dev-khonofy/SKILL.md) | Bug fixes and wise upgrade selection from tester suggestions |

Also see [khonofy-browser-testing](../khonofy-browser-testing/SKILL.md) for focused staff timesheet smoke tests and [khonofy-domain](../khonofy-domain/SKILL.md) for business rules.

## Dual purpose

The suite is **dual-purpose**:

1. **Verify correctness** — does the app work?
2. **Suggest improvements** — what could be better even if it works?

Tests can **pass** while still producing a structured backlog of product improvements.

## Goal

Test the **full app** within each role's permission scope — not just one happy-path flow:

- every route visible to each role
- every visible, enabled, role-appropriate button, link, tab, modal action, and form action
- primary happy paths and validation/error paths where practical
- refresh and navigation persistence
- cross-role handoffs (staff submit → admin review → superuser oversight)
- repair loop when controls fail or hang
- **improvement collection** from all role testers (Bug / Polish / Optimization)

## Improvement collection mode

The orchestrator must collect not only defects, but also improvement ideas from all agents.

### Finding categories

Each finding must be labeled as one of:

| Label | Meaning |
|-------|---------|
| `bug` | Broken, incorrect, or missing behavior |
| `polish` | Works; UX could be clearer or smoother |
| `optimization` | Works; flow could be more efficient or user-friendly |

### Consolidation rules

When merging reports from Staff, Admin, and Superuser testers:

1. Deduplicate similar suggestions across roles (e.g. inconsistent week labels seen by staff and superuser).
2. Keep page path, category, effort (low/medium/high), and tester recommendation (`implement` / `defer` / `reject`).
3. Separate **blocking bugs** from **non-blocking improvements**.
4. Pass the consolidated improvement backlog to Senior-Dev_khonofy after Layer 1–4 complete (or alongside `needs_fix` items).

### Senior dev triage policy

The senior developer should prioritize suggestions using:

- user impact
- implementation risk
- maintenance cost
- frequency of use
- whether it simplifies a core flow

### Action policy

1. **Fix bugs first.**
2. **Apply high-impact improvements next** (implement now: high impact, low risk, clear benefit).
3. **Defer** useful but not urgent ideas.
4. **Reject** noisy, subjective, or low-value churn unless clarity improves materially.
5. **After any upgrade**, senior dev pushes → wait 10 min for deploy → all three testers rerun and confirm on production.

## Continuous improvement loop

**The test suite must not stop until Senior-Dev_khonofy has implemented code fixes or approved upgrades, pushed to the repo, deployment has finished, and the three role testers have rerun and confirmed the changes.**

A passing test suite is not the end — it is the start of improvement review. The suite runs continuously through the **deploy-repair cycle** below until cycle end conditions are met.

This is a **continuous deploy-repair loop**, not a stop-on-pass test.

### Deploy-repair cycle (mandatory)

When bugs or high-value improvements require code changes, the orchestrator **pauses affected testing**, hands off to senior dev, and **does not finish the suite** until the full cycle completes:

```
Staff / Admin / Superuser testers
        ↓  report pass/fail + bug/polish/optimization
Orchestrator consolidates → sends needs_fix / improvement backlog
        ↓
Senior-Dev_khonofy — triage → write code → lint/typecheck
        ↓
Senior-Dev_khonofy — commit + push to repo
        ↓
Senior-Dev_khonofy — wait 10 minutes for Azure deployment to finish
        ↓
Senior-Dev_khonofy — tell all 3 role testers to resume (resume_testing)
        ↓
Staff / Admin / Superuser — rerun impacted pages/flows on deployed app
        ↓
New bugs or high-value suggestions? → loop again from consolidate
        ↓
No open bugs + no high-value backlog → final report
```

**Rules for this cycle:**

1. **Never declare the suite complete** while open `needs_fix` items or unimplemented high-value improvements remain.
2. **Never skip the 10-minute deploy wait** after senior dev pushes — testers must verify the **deployed** app, not local-only changes.
3. **Senior dev must push** — local fixes alone do not unblock the suite.
4. After deploy wait, senior dev (or orchestrator) sends **`resume_testing`** to Staff, Admin, and Superuser testers with explicit rerun scope.
5. Testers **continue the suite** from the orchestrator's rerun instructions — they do not restart provisioning unless orchestrator says so.

### Situation → action

| Situation | What happens |
|-----------|----------------|
| Tests **fail** (`needs_fix`) | Pause affected scope → senior dev fixes → push → wait 10 min → all 3 testers resume |
| Tests **pass** but high-value suggestions exist | Senior dev implements → push → wait 10 min → testers rerun affected pages |
| Tests **pass** and **no suggestions** worth implementing | Orchestrator may advance to next coverage or finish cycle |
| Senior dev **pushed** but deploy not ready | Status `awaiting_deploy` — wait full 10 minutes before `resume_testing` |
| Testers **resumed** after deploy | Rerun impacted pages + connected handoffs; report pass/fail + new findings |

A passing run does **not** automatically end the cycle. Keep the loop alive while worthwhile `polish` or `optimization` items remain for the current cycle.

### Cycle end conditions

End the suite only when **both** are true:

1. **No open bugs** — all `needs_fix` items fixed, pushed, deployed, and rerun-confirmed on production.
2. **No high-value improvements left** — senior dev has implemented, deferred, or rejected every item; implemented items are deployed and rerun-confirmed; deferred/rejected items are documented.

Low-value or deferred items do **not** block cycle completion unless the orchestrator explicitly starts another improvement pass.

### Operating cycle (summary)

```
Testers → Orchestrator → Senior Dev (code + push + 10 min wait) → Testers resume → loop
```

### Example

Staff reports: login works, dashboard works, but week labels are confusing.

The process is **not done**. Senior dev fixes labels → orchestrator reruns staff `/`, `/calendar`, `/timesheets` → testers note new observations → loop continues if needed.

### Khonofy improvement buckets

| Bucket | Examples |
|--------|----------|
| Staff UX | faster calendar entry, clearer totals, smarter defaults |
| Admin UX | better queue filtering, inline review actions, clearer feedback |
| Superuser UX | stronger audit visibility, better oversight summaries |
| System polish | loading states, empty states, consistent date labels |
| Workflow optimization | fewer handoff clicks, cleaner approval flow, clearer status transitions |

## Full-app coverage requirement

The test suite must cover the full app within each role's permission scope.

### Coverage rules

Each agent must test:

- every route visible to its role
- every visible button, tab, menu item, modal action, and form action
- all major happy paths
- at least one validation/error path per page where practical
- state persistence after reload or navigation away and back
- role-based visibility and permission boundaries

### Button coverage rule

For each page, the agent must interact with every **visible, enabled, role-appropriate** button and confirm the result.

This includes:

- primary and secondary action buttons
- dialog buttons (Save, Cancel, Confirm, Close)
- submit / approve / reject / delete actions
- filters, toggles, and tabs that change visible state
- controls inside modals, drawers, and dialogs

This does **not** mean:

- staff should force-test admin-only routes (unless the test purpose is access control)
- hidden or disabled controls should be clicked unless enabling them is part of the test
- destructive actions without a safe test path (use cancel or test data)

### Scope by role

| Role | Pages (see role skills for detail) |
|------|-------------------------------------|
| Staff | Dashboard, Calendar, Daily Task Log, Task Management, Timesheets, Profile; auth pages where relevant |
| Admin | Dashboard, Timesheet Review, Team Management, Project/Tag Management, Admin Reports, Dept Head Summary, Task Management, Profile |
| Superuser | Dashboard, User Management, Audit Trail, Timesheet Feedback, Admin Reports, Projects, Tags, Profile |

Shared flows between roles must be tested end-to-end.

### Failure handling

If any visible control fails, hangs, or produces an incorrect UI state:

1. record the page
2. record the exact control label
3. record the visible result
4. mark `needs_fix` if code changes are needed
5. hand off to [Senior-Dev_khonofy](../senior-dev-khonofy/SKILL.md)
6. senior dev implements → push → wait 10 min → `resume_testing` to all three testers
7. rerun the affected page and connected flow on **production** after deploy

## Test layers (run in order)

Run the suite in layers to stay exhaustive without becoming random:

| Layer | What it covers |
|-------|----------------|
| **Layer 1** | Smoke: login, logout, navigation, every page loads |
| **Layer 2** | Main workflows and role handoffs |
| **Layer 3** | All visible buttons and form actions on each page |
| **Layer 4** | Error handling, refresh persistence, permission boundaries |
| **Layer 5** | Senior dev repair loop and targeted reruns |
| **Improvement** | Bug / Polish / Optimization findings on every page (parallel to Layers 1–4) |

Agents report progress per layer. Do not skip Layer 1 to reach Layer 3. **Always capture improvement findings**, even when a page passes.

## When to use

Use this skill when you need:

- full-app regression after deployment
- page-by-page and button coverage per role
- coordinated staff → admin → superuser workflow validation
- a repair loop when testers find broken controls
- **improvement review** — structured UX/product backlog from passing tests
- one consolidated coverage + improvement report

## Sub-agents and delegation

Launch browser testers with the **Cursor IDE browser MCP** (`cursor-ide-browser`) when possible. Set `position: "active"` on `browser_navigate` when the user wants to watch the run.

Do **not** rely on the `browser-use` subagent unless its API credentials are confirmed working — it has failed with invalid OpenAI API key errors in this project.

Each sub-agent must read its own skill before acting.

## Communication protocol

Every agent must communicate using this structure:

```text
status: <ready|running|blocked|handoff_ready|needs_fix|awaiting_deploy|resume_testing|done>
from: <agent name>
to: <target agent name>
test_case: <short identifier>
summary: <short human-readable summary>
details: <exact steps, visible result, blockers>
next_action: <what the receiving agent should do next>
```

| Status | Meaning |
|--------|---------|
| `needs_fix` | Code defect — pause affected scope; route to senior dev |
| `awaiting_deploy` | Senior dev pushed; waiting 10 minutes for deployment |
| `resume_testing` | Deploy wait complete — role testers continue rerun scope |
| `done` | Agent finished **current** assignment — not suite complete unless orchestrator says so |

Optional coverage fields for page-level reports:

```text
page: <route or screen name>
controls_tested: <count or list summary>
pass_fail: <pass|fail|partial>
broken_controls: <label list or none>
findings:
  - category: <bug|polish|optimization>
    suggestion: <text>
    effort: <low|medium|high>
    worth_now: <yes|no>
```

### Handoff rules

- If one agent completes a workflow another must continue, send `handoff_ready` and wait.
- If any agent finds a code defect, send `needs_fix` to Senior-Dev_khonofy and **pause the affected page/flow** — do **not** end the suite.
- If an agent finds improvements on a **passing** page, include them in `findings` and forward to orchestrator — **never treat pass as cycle complete**.
- When senior dev pushes fixes, orchestrator sets `awaiting_deploy` and waits **10 minutes** for Azure deployment.
- After deploy wait, senior dev (or orchestrator) sends `resume_testing` to **all three role testers** with explicit rerun scope.
- After testers confirm deployed fixes, **continue the loop** if new findings appear.
- **The suite does not stop** until cycle end conditions are met (see Continuous improvement loop).

## Orchestration workflow

0. **Provision fresh test users (mandatory)** — run [khonofy-test-provision](../khonofy-test-provision/SKILL.md):
   - `npm run test:provision` (or `node scripts/provision-test-users.mjs` with `KHONOFY_API_URL` set)
   - Creates new staff, admin, and superuser; password **`Demo123!`** for all three
   - Staff is assigned to the new admin (`admin_id`)
   - Read `.cursor/test-run-credentials.json` and pass emails to each role tester
   - Do **not** reuse Wandile/David/Ali or prior-run credentials for routine suite runs
1. Confirm test environment URL (frontend) and provisioned credentials for staff, admin, and superuser.
2. Open browser visibly if requested (`position: "active"`).
3. **Run all role testers** — Layers 1–4 + improvement findings on every page.
4. **Consolidate** — merge bug/polish/optimization; dedupe; prioritize.
5. **If any failures or high-value improvements need code** → `needs_fix` / backlog to Senior-Dev_khonofy → **pause affected scope; do not stop suite**.
6. **Senior-Dev_khonofy** — triage; implement; lint/typecheck; **commit + push to repo**.
7. **Deploy wait** — set `awaiting_deploy`; wait **10 minutes** for Azure Static Web Apps + backend deployment to finish.
8. **Senior-Dev_khonofy** — send `resume_testing` to Staff, Admin, and Superuser testers with rerun scope (pages, layers, handoffs).
9. **Testers resume** on **production URL** — rerun impacted pages/flows; capture new findings.
10. **Loop** — if new bugs or high-value suggestions appear, return to step 4.
11. **Finish** only when cycle end conditions are met (see Continuous improvement loop).
12. Produce **final consolidated coverage + improvement report** (including implemented, deferred, rejected, deploy cycles, and rerun results).

## Living quality loop (summary)

```
Testers (all roles) → report pass/fail + bug/polish/optimization
        ↓
Orchestrator → consolidate findings → needs_fix / improvement backlog
        ↓
Senior Dev → bugs first → implement → commit + push
        ↓
Wait 10 minutes for deployment
        ↓
Senior Dev → resume_testing → all 3 role testers
        ↓
Testers rerun on deployed app → confirm improvement
        ↓
Loop until no bugs + no high-value backlog → final report
```

## Master app checklist

Copy and track:

```
Provisioning (Step 0 — every run)
- [ ] Fresh staff, admin, superuser created via test:provision
- [ ] All three passwords are Demo123!
- [ ] Staff admin_id points to new admin
- [ ] Credentials written to .cursor/test-run-credentials.json

Authentication
- [ ] Login
- [ ] Register (smoke / validation only if in scope)
- [ ] Forgot Password
- [ ] Reset Password

Staff area
- [ ] Dashboard
- [ ] Calendar
- [ ] Daily Task Log
- [ ] Task Management
- [ ] Timesheet Management
- [ ] Profile

Admin area
- [ ] Dashboard
- [ ] Timesheet Review
- [ ] Team Management
- [ ] Project Management
- [ ] Tag Management
- [ ] Admin Reports
- [ ] Dept Head Summary
- [ ] Task Management
- [ ] Profile

Superuser area
- [ ] Dashboard
- [ ] User Management
- [ ] Audit Trail
- [ ] Timesheet Feedback
- [ ] Admin Reports
- [ ] Projects
- [ ] Tag Management
- [ ] Profile

Cross-role flows
- [ ] Staff submits timesheet
- [ ] Admin reviews it
- [ ] Staff sees updated status
- [ ] Superuser sees cross-role record
- [ ] Audit trail records action if supported

Repair loop (deploy-repair cycle)
- [ ] Tester finds defect (page + control + result)
- [ ] Orchestrator sends needs_fix — suite pauses affected scope (does NOT stop)
- [ ] Senior dev implements fix or upgrade
- [ ] Senior dev runs lint/typecheck
- [ ] Senior dev commits and pushes to repo
- [ ] Wait 10 minutes for Azure deployment
- [ ] Senior dev sends resume_testing to Staff, Admin, Superuser
- [ ] All 3 testers rerun impacted pages on production
- [ ] Before/after recorded in final report
- [ ] Loop repeats until cycle end conditions met

Improvement review
- [ ] Each tester reports bug / polish / optimization per page
- [ ] Orchestrator consolidates and dedupes findings
- [ ] Forward worthwhile suggestions to Senior-Dev_khonofy even when all tests pass
- [ ] Senior dev triages: implement / defer / reject
- [ ] High-value upgrades implemented with minimal diffs
- [ ] Impacted flows rerun and improvement confirmed
- [ ] Loop repeats until no bugs and no high-value backlog remain
- [ ] Deferred and rejected items listed with reasons
```

## Rules

1. All testing must use the real UI through the browser.
2. Do not use internal API shortcuts unless the task explicitly requires them.
3. Do not skip role handoffs for cross-role flows.
4. Do not assume success without visible confirmation.
5. Record every broken control with page, label, and visible result.
6. Route code defects to Senior-Dev_khonofy; route improvements to senior dev for triage — do not guess at fixes during testing.
7. Use slow typing for React controlled inputs — `browser_fill` alone can leave login stuck.
8. A **passing page** must still include improvement findings when warranted — empty improvement sections are OK only when nothing useful was observed.
9. **Do not end the cycle on pass alone** — continue while senior dev has high-value improvements to implement or verify.
10. **Do not end the suite** until senior dev has pushed, deployment has waited 10 minutes, and testers have rerun on the deployed app.
11. During `awaiting_deploy`, orchestrator and testers **wait** — do not rerun against stale production.

## Test environment defaults

| Item | Typical value |
|------|---------------|
| Deployed frontend | `https://polite-smoke-0f9de4610.7.azurestaticapps.net` |
| Local frontend | `http://localhost:5173` |
| Local backend | `http://localhost:3001` |
| Production backend | `https://khonofy-backend-api-d2fscwb7f3aeevac.southafricanorth-01.azurewebsites.net` |

## Test credentials (per run)

**Every suite run starts with Step 0 provisioning.** Do not hardcode role-tester emails in skills.

| Role | Source | Password |
|------|--------|----------|
| Staff | `.cursor/test-run-credentials.json` → `staff.email` | `Demo123!` |
| Admin | `.cursor/test-run-credentials.json` → `admin.email` | `Demo123!` |
| Superuser | `.cursor/test-run-credentials.json` → `superuser.email` | `Demo123!` |

Bootstrap superuser (provision only, not for role testing): `ali.khan@khonology.com` / `Demo123!` unless overridden via env.

Pass `runId`, all three emails, and `Demo123!` in each role-tester handoff.

## Final output (reporting requirement)

The orchestrator must produce:

- summary of all tests (pass/fail per role)
- **pages tested per role** (with pass/fail per page)
- **controls/buttons exercised per page** (summary counts or lists)
- handoff messages that occurred
- **broken controls found** (page, label, visible result)
- **improvement backlog** consolidated by category (`bug`, `polish`, `optimization`)
- code fixes and **upgrades applied** by Senior-Dev_khonofy (if any)
- **triage decisions** — implement / defer / reject with reasons
- **deploy cycles** — each push, 10-minute wait, and rerun round
- **rerun results** after fixes and implemented improvements (on deployed production)
- **remaining gaps** (pages or controls not tested and why)

## Quality bar

A successful orchestrated run means each role agent completed its in-scope coverage, cross-role handoffs were verified, broken controls were escalated, improvements were collected from passing pages, the **continuous improvement loop ran to completion** (bugs fixed, high-value upgrades implemented and rerun-confirmed), and the final report documents implemented, deferred, and rejected items.
