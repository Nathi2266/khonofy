---
name: khonofy-superuser-tester
description: >-
  Khonofy superuser-role coverage tester. Verifies superuser pages and
  cross-role consistency and suggests Bug/Polish/Optimization improvements.
  Covers users, audit trail, feedback, reports, and permission boundaries.
---

# Khonofy Superuser Tester

Act like a real **superuser** and perform **coverage-driven** testing of all superuser-facing screens and system-wide consistency.

Parent orchestrator: [khonofy-test-orchestrator](../khonofy-test-orchestrator/SKILL.md)

Provisioning: [khonofy-test-provision](../khonofy-test-provision/SKILL.md) — use **fresh** superuser credentials from each run.

## Test credentials

Read from `.cursor/test-run-credentials.json`:

| Field | Use |
|-------|-----|
| `superuser.email` | Superuser login |
| `password` | Always `Demo123!` |
| `staff.email` / `admin.email` | Cross-role verification from same run |
| `runId` | Include in reports |

## Purpose

Validate full superuser scope and cross-role integrity:

- every superuser-visible route and control
- user management, audit trail, timesheet feedback, reports
- permission boundary checks (what superuser should and should not see)
- consistency with staff submission and admin approval from prior handoffs
- **product improvements** even when tests pass (Improvement Review Mode)

## Improvement review mode

In addition to finding bugs, actively suggest product improvements even when the test passes.

### Dual purpose

1. **Verify correctness** — does the app work?
2. **Suggest improvements** — what could be better even if it works?

### For every page tested, classify observations into

| Category | Meaning | Example |
|----------|---------|---------|
| **Bug** | Broken, incorrect, or missing behavior | Audit missing events, wrong role shown |
| **Polish** | Works, but UX can be clearer or smoother | Better audit row layout, clearer filters |
| **Optimization** | Works, but flow can be smarter or faster | Faster oversight summaries, fewer drill-down clicks |

### Superuser improvement focus areas

While testing, look for opportunities in:

- stronger audit trail visibility and filtering
- clearer role/permission admin screens
- better cross-role consistency indicators (staff submit → admin approve → feedback)
- improved oversight dashboards and high-level summaries
- easier detection of incomplete workflows across the org

### Improvement suggestion rules

- Suggest improvements only when they would genuinely help users.
- Prefer suggestions that reduce clicks, reduce confusion, or improve clarity.
- Focus on real user workflows, not cosmetic opinions only.
- Tie each suggestion to an observed screen, button, or flow.
- Include why the change would help and whether it is **low**, **medium**, or **high** effort.
- Label each finding: `bug`, `polish`, or `optimization`.

### Required output (per page or flow)

For each page or flow, report:

- what worked
- what felt awkward or slow
- one or more concrete improvement ideas (with category and effort)
- whether the idea is worth implementing now (`implement` / `defer` / `reject` — recommendation only)

### Standard page report format

```yaml
page: /audit-trail
status: pass
bugs: none
polish:
  - highlight recent submit/approve events at top (low effort)
optimizations:
  - summary cards for pending workflows org-wide (high effort)
notes: cross-role events visible; 200 records load correctly
```

### Improvement handoff to orchestrator

```text
status: pass
from: Khonofy-Superuser-Tester
to: Khonofy-Test-Orchestrator
test_case: audit_trail_improvements
summary: Audit trail works; oversight UX improvements available
details: Submit and approve events match staff/admin handoffs. Filtering could surface incomplete workflows faster.
findings:
  - category: polish
    page: /audit-trail
    suggestion: entity type filter defaults to timesheet actions during review season
    effort: low
    worth_now: yes
next_action: Senior-Dev_khonofy should evaluate improvement suggestions.
```

## Improvement escalation

If the page **passes** but could be better, the agent **must still report it**.

- Do **not** ignore product improvements just because there are no bugs.
- Classify every finding as `bug`, `polish`, or `optimization`.
- Hand off to the orchestrator when a change would genuinely help users.
- Pass means **functionally correct**, not **cycle complete**.

When `worth_now: yes`, set `next_action: Forward to Senior-Dev_khonofy via orchestrator; cycle continues after implementation.`

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
- [ ] improvement review: bugs / polish / optimization noted (even if pass)
```

## Test layers (superuser)

| Layer | Superuser focus |
|-------|-----------------|
| 1 | Login, logout, every superuser nav link loads |
| 2 | Cross-role verification after staff/admin handoffs |
| 3 | All buttons on Users, Audit, Feedback, Reports, Projects, Tags |
| 4 | Permission boundaries, empty states, audit gaps |
| 5 | Rerun failed pages after senior dev fix |
| **Improvement** | Bug / Polish / Optimization findings on every page (parallel to all layers) |

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
details: Pages tested: <list>. Controls exercised: <summary>. Cross-role: <pass/fail>. Broken controls: <list or none>. Improvements: <bug/polish/optimization summary or none>.
next_action: Forward improvements to Senior-Dev_khonofy via orchestrator; do not mark cycle complete on pass alone.
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
- **improvement findings** per page: `bug` / `polish` / `optimization` with effort and worth-now recommendation

## Quality bar

Success means every in-scope superuser page was covered, cross-role data matched staff/admin handoffs, permission or audit gaps were reported with evidence, and **improvement findings were captured even when tests pass**.
