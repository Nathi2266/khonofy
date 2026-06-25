---
name: khonofy-test-orchestrator
description: >-
  Coordinates dual-purpose Khonofy browser testing — verify correctness and
  collect Bug/Polish/Optimization improvements from staff, admin, and superuser
  agents. Page coverage, role handoffs, senior-dev triage, and repair reruns.
  Use as the entry point for full multi-role E2E and improvement review runs.
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
5. **After any upgrade**, rerun the affected tests and confirm the improvement.

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
6. rerun the affected page and connected flow after the fix

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
status: <ready|running|blocked|handoff_ready|needs_fix|done>
from: <agent name>
to: <target agent name>
test_case: <short identifier>
summary: <short human-readable summary>
details: <exact steps, visible result, blockers>
next_action: <what the receiving agent should do next>
```

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
- If any agent finds a code defect, send `needs_fix` to Senior-Dev_khonofy and pause the affected page/flow.
- If an agent finds improvements on a **passing** page, include them in `findings` and forward to orchestrator (do not block the run).
- After Senior-Dev_khonofy reports a fix or implemented improvement, rerun the affected page and connected flow only.

## Orchestration workflow

1. Confirm test environment URL and credentials for staff, admin, and superuser.
2. Open browser visibly if requested (`position: "active"`).
3. **Staff Tester** — Layers 1–4 on all staff pages; Layer 2 timesheet submit → handoff.
4. **Admin Tester** — Layers 1–4 on all admin pages; process staff handoff (approve/reject).
5. **Staff Tester** (brief) — verify post-review status on Timesheets if handoff requires it.
6. **Superuser Tester** — Layers 1–4 on all superuser pages; cross-role consistency; improvement findings.
7. **Consolidate improvements** — merge bug/polish/optimization from all testers; dedupe; prioritize.
8. Any `needs_fix` → **Senior-Dev_khonofy** → fix bugs first.
9. **Senior-Dev_khonofy** — triage improvements; implement high-value upgrades; defer/reject others.
10. **Rerun** — affected pages/flows after fixes or implemented improvements; testers confirm.
11. Produce **final consolidated coverage + improvement report**.

## Living quality loop

```
Testers (all roles) → report pass/fail + bug/polish/optimization
        ↓
Orchestrator → consolidate findings
        ↓
Senior Dev → bugs first → wise upgrade selection → minimal code changes
        ↓
Verify + notify orchestrator
        ↓
Testers rerun impacted flows → confirm improvement
        ↓
Final report (coverage + implemented + deferred + rejected)
```

## Master app checklist

Copy and track:

```
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

Repair loop
- [ ] Tester finds defect (page + control + result)
- [ ] Senior dev fixes
- [ ] Orchestrator reruns affected page/flow
- [ ] Before/after recorded in final report

Improvement review
- [ ] Each tester reports bug / polish / optimization per page
- [ ] Orchestrator consolidates and dedupes findings
- [ ] Senior dev triages: implement / defer / reject
- [ ] High-value upgrades implemented with minimal diffs
- [ ] Impacted flows rerun and improvement confirmed
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

## Test environment defaults

| Item | Typical value |
|------|---------------|
| Deployed frontend | `https://polite-smoke-0f9de4610.7.azurestaticapps.net` |
| Local frontend | `http://localhost:5173` |
| Backend (production) | Baked into `VITE_API_URL` at deploy time |

Credentials are always provided in the task — never hardcode passwords in skills.

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
- **rerun results** after fixes and implemented improvements
- **remaining gaps** (pages or controls not tested and why)

## Quality bar

A successful orchestrated run means each role agent completed its in-scope page and control coverage (or cleanly reported blockers), cross-role handoffs were verified in the UI, broken controls were escalated with evidence, improvements were collected even from passing pages, any fixes/upgrades were validated by targeted reruns, and the final report includes both coverage and a prioritized improvement backlog.
