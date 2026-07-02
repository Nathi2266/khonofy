---
name: khonofy-domain
description: >-
  Khonofy business domain — timesheets, tasks, time entries, roles, and
  workflows. Use when implementing or fixing features involving staff/admin/
  superuser permissions, timesheet approval, task assignment, calendar entries,
  or audit logging so the agent makes domain-correct decisions.
---

# Khonofy Domain Model

Use with [khonofy-explore](../khonofy-explore/SKILL.md) when business rules matter.

## User roles

| Role | Who | Key capabilities |
|------|-----|------------------|
| `staff` | Individual contributor | Log time, manage assigned tasks, submit timesheets |
| `admin` | Department / team lead | Review team timesheets, reports, projects, tags |
| `superuser` | System admin | All users, audit trail, timesheet feedback |

Staff may have `admin_id` (their team lead). Users have `department_id` and `designation_id`.

## Core entities and relationships

```
User ──assigned──► Task
User ──logs──────► TimeEntry ──rolls into──► Timesheet (weekly)
Task ──optional──► Project ──optional──► Client
TimeEntry / Task ──tagged with──► Tag
Department ◄── users, projects
ActivityLog ◄── audit events from user actions
```

## Timesheet lifecycle

Statuses (`TimesheetStatus`):

1. `draft` — staff editing entries for the week
2. `pending` — submitted, awaiting admin review
3. `approved` / `rejected` — admin decision
4. `revoke_pending` — staff requested withdrawal after approval

Key pages:

- Staff: `TimesheetManagement.jsx`, `DailyTaskLog.jsx`
- Admin: `TimesheetReview.jsx`
- Superuser: `SuperuserTimesheetFeedback.jsx`

Week boundaries use `week_start` / `week_end` (date-only). Invalidating `myTimesheets`, `weekEntries`, `teamTimesheets`, `pendingTimesheets` is common after changes.

## Tasks

- Priorities: `low`, `medium`, `high`, `urgent`
- Statuses: `todo`, `in_progress`, `completed`, `blocked`
- Assignment: `assigned_to` (user id) + denormalized `assigned_to_name`
- Optional `project_id`, `estimated_hours`, `due_date`

Page: `TaskManagement.jsx` (role-aware list and forms).

## Time entries

- Belong to a user and date; may link to a task or project
- Calendar view aggregates entries: `CalendarView.jsx`, `base44.calendar.listEntries(from, to, userId)`
- Voice ticket flow: `VoiceTicketDialog.jsx` → `base44.ai.generateVoiceTicket` → `logTicket`

## Projects and tags

- `ProjectManagement.jsx` — clients, billable defaults, department scope
- `TagManagement.jsx` — labels for entries/tasks
- `entryTags.js` — tag display helpers

## Audit trail

`AuditTrail.jsx` (superuser) reads `base44.entities.ActivityLog`. When adding destructive or admin actions, check if `logActivity` should fire (grep existing calls in similar pages).

## Reports and admin views

- `AdminReports.jsx` — admin/superuser reporting
- `DeptHeadSummary.jsx` — department estimates / summary (`/dept-summary`)
- Dashboards: `StaffDashboard`, `AdminDashboard`, `SuperuserDashboard` in `src/components/dashboard/`

## Decision guide

| User asks to… | Start here |
|---------------|------------|
| Change timesheet submit/approve rules | `TimesheetManagement.jsx`, `TimesheetReview.jsx`, timesheet routes in `index.js` |
| Task assignment or status | `TaskManagement.jsx`, `Task` model |
| Calendar or voice logging | `src/components/calendar/`, `/api/calendar/`, `/api/ai/` |
| Who can see a menu item | `Layout.jsx` nav arrays + backend `requireAuth` checks |
| New user field | `schema.prisma` User model, serialize, auth `me` endpoint, profile UI |
| Import users | `user-import.js`, `base44.ai.scanUserImport`, `UserManagement.jsx` |

## Field naming reminder

API/JSON uses snake_case (`full_name`, `department_id`). UI forms often use snake_case keys to match API payloads directly. Prisma and backend internal logic use camelCase.
