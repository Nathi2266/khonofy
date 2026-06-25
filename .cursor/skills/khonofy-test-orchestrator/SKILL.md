---
name: khonofy-test-orchestrator
description: >-
  Coordinates full-app, coverage-driven Khonofy browser testing across staff,
  admin, and superuser agents with page-by-page control coverage, role handoffs,
  and Senior-Dev_khonofy repair loops. Use as the entry point for exhaustive
  multi-role E2E test runs.
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
| [Senior-Dev_khonofy](../senior-dev-khonofy/SKILL.md) | Code fixes from tester reports |

Also see [khonofy-browser-testing](../khonofy-browser-testing/SKILL.md) for focused staff timesheet smoke tests and [khonofy-domain](../khonofy-domain/SKILL.md) for business rules.

## Goal

Test the **full app** within each role's permission scope — not just one happy-path flow:

- every route visible to each role
- every visible, enabled, role-appropriate button, link, tab, modal action, and form action
- primary happy paths and validation/error paths where practical
- refresh and navigation persistence
- cross-role handoffs (staff submit → admin review → superuser oversight)
- repair loop when controls fail or hang

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

Agents report progress per layer. Do not skip Layer 1 to reach Layer 3.

## When to use

Use this skill when you need:

- full-app regression after deployment
- page-by-page and button coverage per role
- coordinated staff → admin → superuser workflow validation
- a repair loop when testers find broken controls
- one consolidated coverage report

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
```

### Handoff rules

- If one agent completes a workflow another must continue, send `handoff_ready` and wait.
- If any agent finds a code defect, send `needs_fix` to Senior-Dev_khonofy and pause the affected page/flow.
- After Senior-Dev_khonofy reports a fix, rerun the failed page and connected flow only.

## Orchestration workflow

1. Confirm test environment URL and credentials for staff, admin, and superuser.
2. Open browser visibly if requested (`position: "active"`).
3. **Staff Tester** — Layers 1–4 on all staff pages; Layer 2 timesheet submit → handoff.
4. **Admin Tester** — Layers 1–4 on all admin pages; process staff handoff (approve/reject).
5. **Staff Tester** (brief) — verify post-review status on Timesheets if handoff requires it.
6. **Superuser Tester** — Layers 1–4 on all superuser pages; cross-role consistency.
7. Any `needs_fix` → **Senior-Dev_khonofy** → rerun affected page/flow.
8. Produce **final consolidated coverage report**.

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
```

## Rules

1. All testing must use the real UI through the browser.
2. Do not use internal API shortcuts unless the task explicitly requires them.
3. Do not skip role handoffs for cross-role flows.
4. Do not assume success without visible confirmation.
5. Record every broken control with page, label, and visible result.
6. Route code defects to Senior-Dev_khonofy; do not guess at fixes during testing.
7. Use slow typing for React controlled inputs — `browser_fill` alone can leave login stuck.

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
- code fixes applied by Senior-Dev_khonofy (if any)
- **rerun results** after fixes
- **remaining gaps** (pages or controls not tested and why)

## Quality bar

A successful orchestrated run means each role agent completed its in-scope page and control coverage (or cleanly reported blockers), cross-role handoffs were verified in the UI, broken controls were escalated with evidence, and any fixes were validated by targeted reruns.
