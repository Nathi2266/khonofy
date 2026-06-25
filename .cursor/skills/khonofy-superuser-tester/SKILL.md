---
name: khonofy-superuser-tester
description: >-
  Khonofy superuser-role coverage tester. Tests every superuser page, button,
  audit/history view, permission boundary, and cross-role consistency after
  staff and admin flows complete.
---

# Khonofy Superuser Tester

Act like a real **superuser** and perform **coverage-driven** testing of all superuser-facing screens and system-wide consistency.

Parent orchestrator: [khonofy-test-orchestrator](../khonofy-test-orchestrator/SKILL.md)

## Purpose

Validate full superuser scope and cross-role integrity:

- every superuser-visible route and control
- user management, audit trail, timesheet feedback, reports
- permission boundary checks (what superuser should and should not see)
- consistency with staff submission and admin approval from prior handoffs

## Page coverage map

| Page | Path | Component (reference) |
|------|------|------------------------|
| Dashboard | `/` | `SuperuserDashboard` |
| User Management | `/users` | `UserManagement.jsx` |
| Timesheet Feedback | `/timesheets/feedback` | `SuperuserTimesheetFeedback.jsx` |
| Audit Trail | `/audit-trail` | `AuditTrail.jsx` |
| Reports | `/admin-reports` | `AdminReports.jsx` |
| Projects | `/projects` | `ProjectManagement.jsx` |
| Tag Management | `/tags` | `TagManagement.jsx` |
| Profile | `/profile` | `Profile.jsx` |

Superuser nav: `Layout.jsx` → `SUPERUSER_NAV`.

## Action coverage (each page)

For every superuser page, exercise where available:

- open / close panels, modals, expandable rows
- create / edit / save / cancel (User Management, Projects, Tags)
- search / filter / status tabs (Feedback: Pending, Approved, Rejected, All)
- audit type filters and record expansion
- report filters and refresh
- reload and navigation persistence

## Button coverage rule

Priority pages:

- **User Management** — New User, Import, expand/edit, role controls
- **Audit Trail** — filters, type selectors, scroll/load
- **Timesheet Feedback** — status tabs, search, open record detail
- **Admin Reports** — filters, refresh
- **Projects** / **Tags** — CRUD actions

Click every visible enabled control; record pass/fail per control.

## Permission boundary checks (Layer 4)

Verify:

- superuser sees superuser nav only (no inappropriate staff-only gaps)
- superuser can access `/users`, `/audit-trail`, `/timesheets/feedback`
- attempting staff-only flows is not required unless testing role isolation
- cross-role data from orchestrator handoffs appears on Feedback/Audit

## Per-page testing checklist

```
Page: <name> (<path>)
- [ ] page loads without blocking error
- [ ] visible controls identified
- [ ] each visible enabled button clicked and verified
- [ ] search/filter tabs tested
- [ ] form actions tested where applicable
- [ ] success or error feedback observed
- [ ] page refresh preserves expected state
- [ ] navigate away and back preserves expected state
```

## Test layers (superuser)

| Layer | Superuser focus |
|-------|-----------------|
| 1 | Login, logout, every superuser nav link loads |
| 2 | Cross-role verification after staff/admin handoffs |
| 3 | All buttons on Users, Audit, Feedback, Reports, Projects, Tags |
| 4 | Permission boundaries, empty states, audit gaps |
| 5 | Rerun failed pages after senior dev fix |

## Cross-role verification (Layer 2)

After staff and admin handoffs, confirm on **Timesheet Feedback** and **Audit Trail**:

1. Staff submission week visible with correct hours and status.
2. Admin reviewer and approval/rejection reflected.
3. Audit trail shows submit/approve events if supported.
4. No broken empty states when data should exist.

Use orchestrator context: staff email, admin email, week, action taken.

## Escalation (`needs_fix`)

```text
status: needs_fix
from: Khonofy-Superuser-Tester
to: Senior-Dev_khonofy
test_case: <page>_<control>
page: <path>
summary: <issue one line>
details: Control "<label>" or cross-role check failed. Visible: <actual>. Expected: <expected>. Handoff context: <week, users>.
next_action: Fix; orchestrator reruns page and cross-role check.
```

## Completion message to orchestrator

```text
status: done
from: Khonofy-Superuser-Tester
to: Khonofy-Test-Orchestrator
test_case: superuser_full_coverage
summary: Superuser coverage completed
details: Pages tested: <list>. Controls exercised: <summary>. Cross-role: <pass/fail>. Broken controls: <list or none>.
next_action: Final consolidated report or repair loop.
```

## Browser operating rules

1. Real UI only — Cursor IDE browser MCP preferred.
2. Scroll long lists (audit, feedback).
3. Slow typing for login.
4. `position: "active"` when user watches.

## Output format

Return:

- pages tested (path, pass/fail)
- controls/buttons per page
- cross-role consistency result
- permission boundary observations
- audit/feedback findings
- `needs_fix` messages and gaps

## Quality bar

Success means every in-scope superuser page was covered, cross-role data matched staff/admin handoffs, and permission or audit gaps were reported with evidence.
