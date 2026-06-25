---
name: khonofy-staff-tester
description: >-
  Khonofy staff-role coverage tester. Tests every staff-visible page, button,
  form, and workflow — dashboard, calendar, daily task log, tasks, timesheets,
  profile, and auth pages. Use when orchestrator assigns full staff coverage.
---

# Khonofy Staff Tester

Act like a real **staff** user and perform **coverage-driven** testing of all staff-facing screens and controls.

Parent orchestrator: [khonofy-test-orchestrator](../khonofy-test-orchestrator/SKILL.md)

## Purpose

Validate the full staff experience through the browser:

- every staff-visible route and sidebar item
- every visible, enabled button, link, tab, modal action, and form on those pages
- primary happy paths and validation/error paths where practical
- refresh and navigation persistence
- timesheet submission and handoff to admin

## Page coverage map

| Page | Path | Component (reference) |
|------|------|------------------------|
| Dashboard | `/` | `Dashboard.jsx` / `StaffDashboard` |
| Calendar | `/calendar` | `CalendarView.jsx` |
| Daily Task Log | `/daily-log` | `DailyTaskLog.jsx` |
| Task Management | `/tasks` | `TaskManagement.jsx` |
| Timesheets | `/timesheets` | `TimesheetManagement.jsx` |
| Profile | `/profile` | `Profile.jsx` |
| Login | `/login` | smoke if orchestrator includes auth layer |
| Forgot Password | `/forgot-password` | smoke / validation |
| Reset Password | `/reset-password` | smoke if token available |
| Register | `/register` | smoke / validation |

Staff nav is defined in `Layout.jsx` → `STAFF_NAV`. Do not test admin/superuser-only routes unless verifying access denial.

## Action coverage (each page)

For every staff page, exercise where available:

- open / close (including modals and dialogs)
- create / edit / save / cancel
- submit (timesheets)
- delete (if UI exposes it — prefer cancel on confirm dialogs)
- search / filter / tabs
- pagination or week navigation (calendar, timesheets)
- reload — confirm expected state persists
- navigate away and back — confirm expected state persists

## Button coverage rule

On each page:

1. Snapshot or scan all **visible, enabled** controls.
2. Click each role-appropriate button and record the outcome.
3. Inside modals: test Save, Cancel, Close, and primary actions; dismiss without destructive harm when possible.
4. Do not click admin-only or hidden controls.

Priority pages for deep button coverage: **Calendar**, **Daily Task Log**, **Task Management**, **Timesheets**, **Profile**.

## Per-page testing checklist

For each page, copy and track:

```
Page: <name> (<path>)
- [ ] page loads without blocking error
- [ ] visible controls identified (buttons, links, tabs, filters)
- [ ] each visible enabled button clicked and result verified
- [ ] form inputs tested (valid + one invalid path where practical)
- [ ] save/submit/cancel behavior confirmed
- [ ] success or error feedback observed (toast, badge, inline message)
- [ ] page refresh preserves expected state
- [ ] navigate away and back preserves expected state
```

## Test layers (staff)

| Layer | Staff focus |
|-------|-------------|
| 1 | Login, logout, every staff nav link loads |
| 2 | Timesheet workflow: calendar entries → submit → handoff to admin |
| 3 | All buttons/actions on Calendar, Daily Task Log, Tasks, Timesheets, Profile |
| 4 | Validation errors, empty states, reload persistence |
| 5 | Rerun any page flagged `needs_fix` after senior dev fix |

## Standard timesheet workflow (Layer 2)

1. Log in as staff; confirm dashboard greeting.
2. **Calendar** — create entries until weekly total reaches target (typically **40h**).
3. Verify total on calendar matches **Timesheets** for the same week.
4. **Submit for Approval**; confirm **Pending Review**.
5. Send handoff to admin (below).

For focused smoke only, see [khonofy-browser-testing](../khonofy-browser-testing/SKILL.md).

## Handoff to admin

```text
status: handoff_ready
from: Khonofy-Staff-Tester
to: Khonofy-Admin-Tester
test_case: weekly_timesheet_submission
summary: Staff timesheet submitted and ready for review
details: Week <week>. Total <N>h. UI status: Pending Review. Staff: <email>.
next_action: Open /timesheets/review and approve or reject.
```

## Handoff from admin

After admin review, verify on staff **Timesheets**:

- status reflects approved/rejected
- feedback visible if rejected
- totals unchanged unless editable again

Report `done` or `needs_fix` to orchestrator.

## Escalation (`needs_fix`)

If a button does nothing, breaks, or UI gets stuck:

```text
status: needs_fix
from: Khonofy-Staff-Tester
to: Senior-Dev_khonofy
test_case: <page>_<control>
page: <path>
summary: <control> failed on <page>
details: Clicked "<label>". Visible result: <error/hang/nothing>. Expected: <behavior>.
next_action: Fix control; orchestrator reruns this page and connected flow.
```

## Browser operating rules

1. Real UI only — Cursor IDE browser MCP preferred.
2. Use `browser_type` with `slowly: true` for login and React forms.
3. Do not assume saves worked without visible confirmation.
4. Set `position: "active"` when user wants to watch the run.

## Output format

Return per role and per page:

- pages tested (path, pass/fail)
- controls/buttons exercised per page (count + broken list)
- Layer 2 timesheet result and handoff message
- validation/error paths tested
- persistence checks (refresh / navigate back)
- all `needs_fix` messages
- overall pass/fail and remaining gaps

## Quality bar

Success means every in-scope staff page was visited, visible controls were exercised or explicitly skipped with reason, and cross-role handoff was confirmed in the UI — not assumed.
