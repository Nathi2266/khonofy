---
name: khonofy-test-provision
description: >-
  Step 0 for the Khonofy test orchestration loop. Provisions fresh staff, admin,
  and superuser before the first RUN cycle. Reuse same credentials across loop
  iterations until the user stops the session.
---

# Khonofy Test Provision

**Step 0 — once per suite session.** Called by [khonofy-test-orchestrator](../khonofy-test-orchestrator/SKILL.md) before the first **Wait → Run** cycle.

## When to provision

| When | Action |
|------|--------|
| **Session start** | Always provision fresh users before first test cycle |
| **Loop repeat** | Reuse same `.cursor/test-run-credentials.json` — do not re-provision |
| **After fix/deploy** | Same credentials — orchestrator sends `rerun` only |
| **New session** | User starts a new loop → provision again |

## Goal

Brand-new users each session — never reuse Wandile/David/Ali or prior session accounts.

| Role | Password |
|------|----------|
| Staff | `Demo123!` |
| Admin | `Demo123!` |
| Superuser | `Demo123!` |

Staff **must** have `admin_id` → new admin (timesheet handoff works).

## Emails (per session)

- `test.staff.{runId}@khonology.com`
- `test.admin.{runId}@khonology.com`
- `test.superuser.{runId}@khonology.com`

## Script

```bash
npm run test:provision
# or with production API:
KHONOFY_API_URL=https://khonofy-backend-api-d2fscwb7f3aeevac.southafricanorth-01.azurewebsites.net npm run test:provision
```

Writes `.cursor/test-run-credentials.json` (gitignored).

Bootstrap superuser (create only): `ali.khan@khonology.com` / `Demo123!`

## Handoff to orchestrator

```text
status: handoff_ready
from: Khonofy-Test-Provision
to: Khonofy-Test-Orchestrator
test_case: fresh_test_users
summary: Fresh staff, admin, superuser for session {runId}
details:
  runId: {runId}
  password: Demo123!
  staff_email: ...
  admin_email: ...
  superuser_email: ...
  staff_admin_assigned: yes
next_action: Senior dev confirms deploy live (WAIT) → orchestrator dispatches RUN.
```

## Rules

1. Provision once per session — not every loop cycle.
2. Password always **`Demo123!`** for all three test users.
3. Confirm staff `admin_id` before timesheet handoff tests.
4. Do not delete bootstrap superuser.
