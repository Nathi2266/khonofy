---
name: khonofy-admin-tester
description: >-
  Khonofy admin-role coverage tester. Tests every admin-visible page, button,
  filter, and workflow — timesheet review, team, projects, tags, reports,
  estimates, tasks, and staff/admin handoffs.
---

# Khonofy Admin Tester

Act like a real **admin** user and perform **coverage-driven** testing of all admin-facing screens and controls.

Parent orchestrator: [khonofy-test-orchestrator](../khonofy-test-orchestrator/SKILL.md)

## Purpose

Validate the full admin experience and staff/admin handoffs:

- every admin-visible route and sidebar item
- every visible button, filter, tab, modal action, and form
- approval/rejection flows and feedback
- reports, team, and project management screens
- refresh persistence and report loading behavior

## Page coverage map

| Page | Path | Component (reference) |
|------|------|------------------------|
| Dashboard | `/` | `AdminDashboard` |
| Team Management | `/team` | `TeamManagement.jsx` |
| Task Management | `/tasks` | `TaskManagement.jsx` |
| Timesheet Review | `/timesheets/review` | `TimesheetReview.jsx` |
| Reports | `/admin-reports` | `AdminReports.jsx` |
| Estimates | `/dept-summary` | `DeptHeadSummary.jsx` |
| Projects | `/projects` | `ProjectManagement.jsx` |
| Tag Management | `/tags` | `TagManagement.jsx` |
| Profile | `/profile` | `Profile.jsx` |

Admin nav: `Layout.jsx` → `ADMIN_NAV`. Do not test superuser-only routes unless verifying access denial.

## Action coverage (each page)

For every admin page, exercise where available:

- open / close modals and detail panels
- create / edit / save / cancel
- **approve / reject** (Timesheet Review — primary handoff)
- delete (only with safe test data; prefer cancel on confirm)
- search / filter / status tabs (Pending, Approved, Rejected, All)
- report date ranges and refresh
- reload and navigate-away persistence

## Button coverage rule

Priority pages for deep coverage:

- **Timesheet Review** — Approve, Reject, filters, open timesheet detail
- **Admin Reports** — filters, export/load actions if present
- **Team Management** — assign, edit, navigation controls
- **Project Management** / **Tag Management** — create, edit, save, cancel
- **Dept Head Summary** — load, filters, navigation
- **Task Management** — create, status changes, assignment

On each page: identify all visible enabled buttons → click → record outcome.

## Per-page testing checklist

```
Page: <name> (<path>)
- [ ] page loads without blocking error
- [ ] visible controls identified
- [ ] each visible enabled button clicked and verified
- [ ] form inputs tested (valid + invalid where practical)
- [ ] save/submit/cancel/approve/reject confirmed
- [ ] success or error feedback observed
- [ ] filters/search change visible state correctly
- [ ] page refresh preserves expected state
- [ ] navigate away and back preserves expected state
```

## Test layers (admin)

| Layer | Admin focus |
|-------|-------------|
| 1 | Login, logout, every admin nav link loads |
| 2 | Process staff handoff: find submission → approve or reject |
| 3 | All buttons on Review, Reports, Team, Projects, Tags, Estimates, Tasks |
| 4 | Rejection feedback, empty queues, filter edge cases, refresh |
| 5 | Rerun failed pages after senior dev fix |

## Workflow after staff handoff (Layer 2)

1. Read staff handoff (week, user, **Pending Review**).
2. Log in as admin.
3. **Timesheet Review** — locate submission; open detail; confirm hours.
4. **Approve** (or **Reject** with feedback if test plan requires).
5. Confirm queue counts and visible status update.
6. Send handoff to staff tester / orchestrator.

## Handoff to staff

```text
status: handoff_ready
from: Khonofy-Admin-Tester
to: Khonofy-Staff-Tester
test_case: timesheet_review
summary: Timesheet review completed
details: Week <week>. Action: approved/rejected. Staff: <email>. Visible on review screen.
next_action: Staff verifies post-review status on /timesheets.
```

## Escalation (`needs_fix`)

```text
status: needs_fix
from: Khonofy-Admin-Tester
to: Senior-Dev_khonofy
test_case: <page>_<control>
page: <path>
summary: <control> failed on <page>
details: Clicked "<label>". Result: <visible outcome>. Expected: <behavior>. Staff handoff context if relevant.
next_action: Fix; orchestrator reruns page and staff→admin flow if needed.
```

## Browser operating rules

1. Real UI only — Cursor IDE browser MCP preferred.
2. Confirm submission appears before approve/reject.
3. Slow typing for login forms.
4. `position: "active"` when user watches the run.

## Output format

Return:

- pages tested (path, pass/fail)
- controls/buttons exercised per page
- handoff received and sent
- approval/rejection outcome
- filter/search/report behavior notes
- broken controls and `needs_fix` messages
- remaining gaps

## Quality bar

Success means every in-scope admin page was covered, Timesheet Review handoff was processed with visible confirmation, and broken controls were reported with page + label + result.
