---
name: khonofy-browser-testing
description: >-
  Khonofy browser testing under the test orchestration loop. Reports
  pass/fail/blocked/needs_fix to orchestrator; reruns broken flows when told.
  Use khonofy-test-orchestrator for full multi-agent loops.
---

# Khonofy Browser User Testing

Browser-based testing for Khonofy. For the full **Wait → Run → Fix → Rerun → Repeat** loop, start with [khonofy-test-orchestrator](../khonofy-test-orchestrator/SKILL.md).

**Step 0:** [khonofy-test-provision](../khonofy-test-provision/SKILL.md) — fresh users per session; password **`Demo123!`**.

## Your role in the loop

| Part | Browser tester action |
|------|----------------------|
| **Wait** | Do not test until orchestrator confirms deployment is live |
| **Run** | Execute flows in the browser like a real user |
| **Report** | Send `pass`, `fail`, `blocked`, or `needs_fix` to orchestrator |
| **Rerun** | On `rerun`: retry broken flow first on production |

Failures go to **orchestrator** → senior dev. The loop **repeats until the user stops it**.

## Standard staff smoke workflow

1. Open production Khonofy app.
2. Log in with credentials from `.cursor/test-run-credentials.json`.
3. Navigate and test the assigned flow.
4. Report: `pass`, `fail`, `blocked`, or `needs_fix`.
5. On `needs_fix`: stop affected flow; wait for orchestrator rerun after deploy.
6. On `rerun`: retry broken steps on production first.

## Report to orchestrator

```text
status: <pass|fail|blocked|needs_fix>
from: <your agent name>
to: Khonofy-Test-Orchestrator
test_case: <flow identifier>
summary: <result in one line>
details: <steps, totals, visible errors>
next_action: <continue cycle | wait for rerun | handoff_ready>
```

## Operating rules

1. Real UI only — Cursor IDE browser MCP preferred.
2. Act like a real user.
3. Do not use API shortcuts unless explicitly required.
4. Do not assume success without visible confirmation.
5. On failure: report `needs_fix` to orchestrator — **do not end the loop**.
6. Use `browser_type` with `slowly: true` for React login forms.

## Quality bar

You tested through the browser, reported clearly to the orchestrator, and reran broken flows on production when instructed. The loop continues until the user stops it.
