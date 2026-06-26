---
name: khonofy-test-provision
description: >-
  Provisions fresh staff, admin, and superuser test accounts before each Khonofy
  test suite run. Creates three new users (password Demo123!), assigns the admin
  to the staff user, and writes credentials for the orchestrator and role testers.
---

# Khonofy Test Provision

**Mandatory Step 0** for every orchestrated test run. Called by [khonofy-test-orchestrator](../khonofy-test-orchestrator/SKILL.md).

**Note:** Provision once at suite start. During deploy-repair cycles within the same run, **reuse** the same `.cursor/test-run-credentials.json` — do not re-provision unless orchestrator instructs (e.g. corrupted test data).

## Goal

Each test run uses **brand-new users** — never reuse Wandile/David/Ali or prior run accounts.

| Role | Created fresh | Password |
|------|---------------|----------|
| Staff | Yes | `Demo123!` |
| Admin | Yes | `Demo123!` |
| Superuser | Yes | `Demo123!` |

**Staff must have `admin_id` set** to the new admin user so timesheet submit and admin review handoffs work.

## Email pattern (per run)

Each run gets a unique `runId`. Emails:

- `test.staff.{runId}@khonology.com`
- `test.admin.{runId}@khonology.com`
- `test.superuser.{runId}@khonology.com`

Password for all three: **`Demo123!`**

## Bootstrap superuser

Creating users requires an existing superuser (factory account). Defaults:

| Variable | Default |
|----------|---------|
| `KHONOFY_BOOTSTRAP_SUPERUSER_EMAIL` | `ali.khan@khonology.com` |
| `KHONOFY_BOOTSTRAP_SUPERUSER_PASSWORD` | `Demo123!` |

The bootstrap account is **only for provisioning** — role testers log in as the **new** trio.

## Provision script (preferred)

From repo root:

```bash
# Local
KHONOFY_API_URL=http://localhost:3001 node scripts/provision-test-users.mjs

# Production backend
KHONOFY_API_URL=https://khonofy-backend-api-d2fscwb7f3aeevac.southafricanorth-01.azurewebsites.net node scripts/provision-test-users.mjs
```

Or via npm:

```bash
npm run test:provision
```

### Output

- Prints JSON to stdout
- Writes `.cursor/test-run-credentials.json` (gitignored)

Example:

```json
{
  "runId": "2026-06-25T12-00-00-abc123",
  "password": "Demo123!",
  "staff": { "email": "test.staff....@khonology.com", "adminEmail": "test.admin....@khonology.com" },
  "admin": { "email": "test.admin....@khonology.com" },
  "superuser": { "email": "test.superuser....@khonology.com" }
}
```

## Browser fallback (if script cannot run)

1. Log in as bootstrap superuser.
2. **User Management** → create **Admin** (`Demo123!`).
3. Create **Staff** with same password; set **Assigned admin** to the new admin.
4. Create **Superuser** with same password.
5. Record all three emails + `Demo123!` in the handoff block below.

## Handoff to orchestrator

```text
status: handoff_ready
from: Khonofy-Test-Provision
to: Khonofy-Test-Orchestrator
test_case: fresh_test_users
summary: Fresh staff, admin, superuser provisioned for run {runId}
details:
  runId: {runId}
  password: Demo123!
  staff_email: test.staff.{runId}@khonology.com
  admin_email: test.admin.{runId}@khonology.com
  superuser_email: test.superuser.{runId}@khonology.com
  staff_admin_assigned: yes
next_action: Staff tester logs in with staff_email and Demo123!
```

## Rules

1. **Never skip provisioning** at the start of a full suite run.
2. **Never reuse** credentials from a previous run's `.cursor/test-run-credentials.json` for a new run — always provision again.
3. Password is always **`Demo123!`** for all three test users.
4. Confirm staff `admin_id` is set before staff timesheet submit tests.
5. Do not delete bootstrap superuser.
6. During deploy-repair cycles, credentials from the same run remain valid — testers resume with the same `runId` after senior dev push + 10 min wait.

## Failure handling

| Error | Action |
|-------|--------|
| Bootstrap login fails | Verify bootstrap email/password; check API URL |
| Email already registered | Re-run script (new runId) or use fresh runId |
| Forbidden on create | Bootstrap account must be superuser |
| Staff submit blocked (no admin) | Re-provision; verify `admin_id` on staff user |
