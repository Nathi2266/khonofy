---
name: khonofy-test-orchestrator
description: >-
  Senior-dev-led Khonofy test orchestration loop. Waits for deployment, coordinates
  staff/admin/superuser testers running the suite continuously, hands failures to
  senior dev for repair, reruns affected flows. Repeats until the user stops the loop.
---

# Khonofy Test Orchestrator

**This is a test-orchestration loop — not a code-change task.**

Your job is to **keep the loop moving** and **collect results**. You coordinate who runs what, when the senior dev waits, how failures are handed off, and how reruns happen. You do not implement fixes yourself.

## Recommended roles

| Role | Skill | Job |
|------|-------|-----|
| **Orchestrator** | This skill | Keep the loop moving; collect and route results |
| **Senior Dev** | [Senior-Dev_khonofy](../senior-dev-khonofy/SKILL.md) | Wait for deployment; review failures; make fixes; trigger reruns |
| **Agent 1: Staff Tester** | [Khonofy-Staff-Tester](../khonofy-staff-tester/SKILL.md) | Test staff flows |
| **Agent 2: Admin Tester** | [Khonofy-Admin-Tester](../khonofy-admin-tester/SKILL.md) | Test admin flows |
| **Agent 3: Superuser Tester** | [Khonofy-Superuser-Tester](../khonofy-superuser-tester/SKILL.md) | Test superuser and cross-role flows |
| **Provision (Step 0)** | [Khonofy-Test-Provision](../khonofy-test-provision/SKILL.md) | Fresh staff, admin, superuser per suite session |

Also see [khonofy-browser-testing](../khonofy-browser-testing/SKILL.md) and [khonofy-domain](../khonofy-domain/SKILL.md).

## Loop structure

| Part | Meaning |
|------|---------|
| **Wait** | No testing until deployment is ready |
| **Run** | Three agents test (parallel or in sequence) |
| **Fix** | Senior dev handles failures handed off from testers |
| **Rerun** | Retry broken flows first; nearby flows if needed |
| **Repeat** | Continue until the user stops the loop |

## Test orchestration loop (mandatory flow)

```
WAIT — Senior dev confirms deployment is live (~10 min after push, or CI green)
        ↓
RUN — Staff, Admin, Superuser agents run their assigned suites
        ↓
REPORT — Each agent returns: pass | fail | blocked | needs_fix
        ↓
Any failure? ──no──→ REPEAT (next suite cycle)
        │
       yes
        ↓
FIX — Orchestrator sends needs_fix → Senior dev fixes smallest correct thing → push
        ↓
WAIT — Senior dev waits for deployment to finish again
        ↓
RERUN — Affected agent(s) rerun broken flow first, then nearby flows if needed
        ↓
REPEAT — Loop continues until user stops
```

**The loop runs forever until stopped.** A passing cycle does **not** end the loop.

## Stop conditions

Stop the loop **only** when:

1. **The user says stop**, or
2. **Deployment is no longer changing** and the user wants a **final report**.

Do **not** auto-stop because all tests passed or because improvement suggestions were collected.

## Orchestrator responsibilities

1. **Provision** — Step 0 fresh users once per suite session ([khonofy-test-provision](../khonofy-test-provision/SKILL.md)).
2. **Wait gate** — Do not start or resume testing until senior dev confirms deployment is live.
3. **Dispatch** — Assign suite scope to Staff, Admin, Superuser testers.
4. **Collect** — Merge each agent's report: `pass`, `fail`, `blocked`, or `needs_fix`.
5. **Route failures** — Send `needs_fix` to senior dev with page, control, visible result.
6. **Trigger reruns** — After senior dev fix + deploy wait, tell affected agent(s) what to rerun.
7. **Repeat** — Start the next cycle; keep a running log of cycles, failures, fixes, reruns.
8. **Final report** — When user stops, produce consolidated results.

## Senior dev responsibilities (orchestrator view)

The senior dev **does not run tests**. The senior dev:

1. **Waits** until the new build is live before any test cycle starts or resumes.
2. **Reviews** failure reports routed by the orchestrator.
3. **Fixes** the smallest correct thing for each `needs_fix`.
4. **Pushes** so deployment can update (when a code fix is required).
5. **Waits** again for deployment after push.
6. **Tells orchestrator** deploy is ready → orchestrator sends rerun instructions to testers.

## When failures happen

1. Tester sends `needs_fix` to orchestrator (not directly ending the loop).
2. Orchestrator pauses **only the affected flow**; other agents may continue or wait per orchestrator decision.
3. Orchestrator forwards to senior dev.
4. Senior dev fixes → push → wait for deploy.
5. Orchestrator sends **rerun** to the agent that found the bug:
   - **First:** rerun the broken flow only.
   - **Then:** rerun nearby/connected flows if needed (e.g. staff submit → admin review after calendar fix).
6. On pass → orchestrator continues the loop (next cycle or remaining coverage).

## Agent report format

Each tester returns one of:

| Result | Meaning |
|--------|---------|
| `pass` | Flow/page works as expected |
| `fail` | Incorrect behavior but may not need code (e.g. bad test data) |
| `blocked` | Cannot proceed — environment, credentials, or deploy issue |
| `needs_fix` | Code defect — hand off to senior dev |

Optional improvement notes (`polish` / `optimization`) may be attached but **do not drive the loop** — only failures trigger the Fix step.

## Communication protocol

```text
status: <ready|running|pass|fail|blocked|needs_fix|handoff_ready|awaiting_deploy|rerun|stopped>
from: <agent name>
to: <target agent name>
test_case: <short identifier>
summary: <short human-readable summary>
details: <exact steps, visible result, blockers>
next_action: <what the receiving agent should do next>
```

| Status | Meaning |
|--------|---------|
| `awaiting_deploy` | Senior dev pushed or initial wait — no testing yet |
| `needs_fix` | Code defect — orchestrator routes to senior dev |
| `rerun` | Deploy ready — tester reruns listed scope |
| `handoff_ready` | Cross-role workflow ready for next agent |
| `stopped` | User ended the loop — produce final report |

### Handoff rules

- Cross-role flows: staff → admin → superuser use `handoff_ready`.
- Failures: tester → orchestrator → senior dev (`needs_fix`).
- After fix + deploy: orchestrator → tester (`rerun` with exact scope).
- **Never end the loop** on pass — orchestrator schedules the next cycle unless user stops.

## Orchestration workflow

0. **Provision** — `npm run test:provision`; read `.cursor/test-run-credentials.json`.
1. **Wait** — Senior dev confirms deployment is live (initial or post-fix).
2. **Run** — Dispatch Staff, Admin, Superuser testers (parallel or sequence).
3. **Collect** — Merge reports from all three agents.
4. **If `needs_fix`** — Route to senior dev; set `awaiting_deploy` while fix deploys.
5. **After deploy ready** — Send `rerun` to affected agent(s); broken flow first.
6. **Repeat** — Go to step 2 (next cycle).
7. **Stop** — Only when user says stop or wants final report with stable deployment.

## Test layers (per cycle)

| Layer | What it covers |
|-------|----------------|
| **Layer 1** | Smoke: login, navigation, every page loads |
| **Layer 2** | Main workflows and role handoffs |
| **Layer 3** | Visible buttons and form actions |
| **Layer 4** | Error paths, refresh persistence, permissions |

Agents may advance through layers across cycles. The orchestrator tracks progress across loop iterations.

## Scope by role

| Role | Pages |
|------|-------|
| Staff | Dashboard, Calendar, Daily Task Log, Tasks, Timesheets, Profile |
| Admin | Dashboard, Timesheet Review, Team, Projects, Tags, Reports, Estimates, Tasks, Profile |
| Superuser | Dashboard, Users, Audit Trail, Timesheet Feedback, Reports, Projects, Tags, Profile |

Cross-role: staff submit → admin review → staff status → superuser oversight.

## Sub-agents and delegation

Use **Cursor IDE browser MCP** (`cursor-ide-browser`). Set `position: "active"` when the user wants to watch.

Each sub-agent reads its own skill before acting.

## Test environment

| Item | Value |
|------|-------|
| Production frontend | `https://polite-smoke-0f9de4610.7.azurestaticapps.net` |
| Production backend | `https://khonofy-backend-api-d2fscwb7f3aeevac.southafricanorth-01.azurewebsites.net` |
| Credentials | `.cursor/test-run-credentials.json` — password `Demo123!` for all three roles |

## Master checklist

```
Session start
- [ ] Fresh users provisioned (Step 0)
- [ ] Senior dev confirms deployment live (WAIT)
- [ ] Orchestrator dispatches all 3 testers (RUN)

Each cycle
- [ ] Staff / Admin / Superuser reports collected
- [ ] needs_fix routed to senior dev (FIX)
- [ ] Senior dev waits for deploy after push (WAIT)
- [ ] Affected tester reruns broken flow first (RERUN)
- [ ] Nearby flows rerun if needed
- [ ] Orchestrator logs cycle and continues (REPEAT)

Session end (user stop only)
- [ ] Final consolidated report produced
```

## Rules

1. Real UI through the browser only.
2. Orchestrator **coordinates** — does not implement fixes.
3. **Wait before Run** — no testing until deployment is ready.
4. Failures → senior dev → wait → rerun affected flow.
5. **Loop continues until user stops** — pass does not end the loop.
6. Rerun **broken flow first**, then connected/nearby flows.
7. Use slow typing for React login forms (`browser_type` with `slowly: true`).

## Final report (when user stops)

- cycles completed
- pass/fail/blocked/needs_fix per role per cycle
- failures found and fixes applied
- deploy waits and rerun results
- pages/flows still untested
- improvement notes (informational only)

## Quality bar

Success means the orchestrator kept **Wait → Run → Fix → Rerun → Repeat** moving, collected results every cycle, routed failures correctly, and only stopped when the user requested it.
