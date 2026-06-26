---
name: khonofy-browser-testing
description: >-
  Khonofy browser user testing for end-to-end UI validation and improvement
  review. Use when an agent needs to log in, navigate like a real user, verify
  timesheet flows, and report Bug/Polish/Optimization findings from the UI.
---

# Khonofy Browser User Testing

Use this skill to delegate real-user browser testing for Khonofy.

For coordinated **staff + admin + superuser** runs with handoffs and repair loops, start with [khonofy-test-orchestrator](../khonofy-test-orchestrator/SKILL.md) instead.

**Step 0:** [khonofy-test-provision](../khonofy-test-provision/SKILL.md) must run first — each suite run creates fresh users; password is always **`Demo123!`**. Read `.cursor/test-run-credentials.json` for staff email before login.

## Purpose

Test the application through the UI exactly like a staff user would:

- log in
- navigate to calendar or time entry screens
- create entries until the requested weekly total is reached
- verify totals on the calendar and timesheet views
- submit the timesheet
- report any visible errors or mismatches with exact steps
- **suggest improvements** (Bug / Polish / Optimization) even when the flow passes

## Improvement review mode

When running staff smoke tests, also capture product improvements:

| Category | Meaning |
|----------|---------|
| **Bug** | Broken or misleading behavior |
| **Polish** | Works; clearer labels, loading, or empty states would help |
| **Optimization** | Works; fewer clicks or better defaults would help |

Focus areas: faster time entry, clearer week labels, better totals display, submit status visibility.

Per flow, report what worked, what felt awkward, concrete ideas (with effort), and whether worth implementing now.

**Escalation:** Pass does not end the cycle. Forward `worth_now: yes` findings to the orchestrator for senior dev triage.

See [khonofy-staff-tester](../khonofy-staff-tester/SKILL.md) for full improvement review and escalation rules.

## Scope

This skill is for browser-based end-to-end validation only.

Focus on:

- login flows
- calendar and time entry flows
- weekly timesheet totals
- timesheet submission
- visible validation and success states
- bug reporting with exact UI steps

## When to use

Use this skill when you need to:

- verify a new feature or bug fix from the user perspective
- smoke test the app after deployment
- check staff timesheet submission flows
- validate calendar-based time entry behavior
- confirm role-based UI behavior as a real user

## Operating rules

1. Use the app through the browser only.
2. Act like a real user, not a developer probing internals.
3. Do not use API calls unless the task explicitly asks for them.
4. Do not assume success without visible confirmation.
5. If something fails, report the exact step and the visible error.
6. Prefer simple, repeatable test data.
7. Stop immediately on the first unrecoverable failure and report it.

## Standard workflow

1. Open the Khonofy application in the browser.
2. Log in with the provided test credentials.
3. Confirm the landing page or dashboard is visible.
4. Navigate to the calendar or time entry screen.
5. Create time entries through the UI until the weekly total reaches the requested target.
6. Verify that the visible weekly total matches the target.
7. Open the timesheet page for the same week.
8. Confirm the totals and status on the timesheet screen.
9. Submit the timesheet.
10. Confirm the status changes to the expected submitted state.
11. Report the final result clearly.

## Validation requirements

Before submission, confirm:

- login succeeded
- the correct account is active
- entries saved successfully
- the weekly total is correct
- the timesheet view matches the calendar entries
- the submit action completed successfully
- the status changed after submission

## Data handling

- Read credentials from `.cursor/test-run-credentials.json` after Step 0 provision (staff email + `Demo123!`).
- Do not reuse legacy fixed accounts (Wandile/David/Ali) for routine runs.
- Create realistic work entries.
- Match the exact hour target requested by the task.
- If the target is 40 hours, verify the total reaches 40 before submitting.

## Error handling

If any step fails:

- stop the flow
- identify the exact page and control involved
- capture the visible error message
- report whether the issue is reproducible
- do not silently skip the failed step

## Output format

Return a concise report containing:

- test objective
- login result
- navigation path used
- entries created
- total hours observed
- submission result
- bugs or mismatches found
- **improvement findings** (`bug` / `polish` / `optimization`) with effort and worth-now note
- screenshots or UI notes if available

## Browser agent prompt

Use this prompt when delegating to a browser-testing agent:

> You are a browser testing agent. Act like a real Khonofy user.
>
> Task:
> 1. Open the Khonofy app.
> 2. Log in with the provided test credentials.
> 3. Navigate to the calendar/time-entry area.
> 4. Create time entries through the UI until the weekly total reaches exactly 40 hours.
> 5. Verify the total is visible and correct.
> 6. Go to the timesheet page for the same week.
> 7. Confirm the timesheet shows the same total.
> 8. Submit the timesheet.
> 9. Verify the status changes to submitted/pending or the app's expected post-submit state.
> 10. Report the exact result.
>
> Important rules:
> - Use only the UI.
> - Click and type like a real user.
> - Do not use API shortcuts.
> - Do not assume saves worked unless the interface confirms it.
> - If there is an error, stop and report the exact page, action, and message.
> - If you need to choose a day or week, use the current visible UI context.
> - Provide a final summary with pass/fail, steps taken, totals observed, bugs, and improvement suggestions (bug/polish/optimization).

## Quality bar

A successful run means the agent verified the full user journey end to end, did not rely on hidden state or assumptions, and captured improvement ideas when the flow passes but UX could be better.
