---
name: khonofy-explore
description: >-
  Explores the Khonofy codebase before making changes. Use at the start of any
  Khonofy task — new features, bug fixes, refactors, or questions about how
  the app works. Read this skill first so edits target the right layer
  (frontend, backend, Base44 config) and follow existing patterns.
---

# Khonofy — Explore Before Edit

**Never guess.** Before writing or changing code, map the task to the right files and patterns.

## Exploration checklist

Copy and track:

```
Explore progress:
- [ ] Identify layer(s): frontend / backend / base44 / both
- [ ] Find the page or route involved
- [ ] Trace data flow: UI → base44 client → API → Prisma
- [ ] Read 1–2 similar existing implementations
- [ ] Check role permissions if user-facing
- [ ] Note lint/typecheck scope for files you will touch
```

## Quick file map

| Area | Path | Notes |
|------|------|-------|
| Routes | `src/App.jsx` | All pages registered here |
| Nav / roles | `src/components/Layout.jsx` | `STAFF_NAV`, `ADMIN_NAV`, `SUPERUSER_NAV` |
| Auth | `src/lib/AuthContext.jsx`, `src/components/ProtectedRoute.jsx` | JWT in localStorage |
| API client | `src/api/base44Client.js` | All frontend HTTP goes through `base44` |
| Data hooks | `src/hooks/useCurrentUser.js` | React Query patterns |
| Pages | `src/pages/*.jsx` | One file per screen |
| Shared UI | `src/components/`, `src/components/ui/` | shadcn/Radix primitives in `ui/` |
| Backend entry | `backend/src/index.js` | Express routes, auth, CRUD |
| DB schema | `backend/prisma/schema.prisma` | Source of truth for models |
| Serialization | `backend/src/lib/serialize.js` | camelCase DB ↔ snake_case API |
| Base44 sync | `base44/entities/*.jsonc` | Entity definitions for Base44 platform |
| Env | `.env.local` (frontend), `backend/.env` | See `README.md` |

## Decision tree — where does this change go?

```
User-facing screen or component?
  → src/pages/ or src/components/
  → Data via base44.entities.* or base44.auth / base44.calendar / base44.ai

New or changed REST endpoint / DB field / business rule?
  → backend/src/index.js (+ schema.prisma if model changes)
  → Mirror in src/api/base44Client.js if frontend needs it

Entity shape for Base44 platform only?
  → base44/entities/*.jsonc

Auth / login / roles?
  → backend/src/lib/auth.js + frontend AuthContext + ProtectedRoute
```

## How to trace a feature

1. **Route** — grep the path in `App.jsx` (e.g. `/timesheets` → `TimesheetManagement.jsx`).
2. **API calls** — grep the page for `base44.` to see entities and methods used.
3. **Backend** — grep `RESOURCE_MAP` or route path in `backend/src/index.js`.
4. **Model** — open matching model in `schema.prisma`.
5. **Reference impl** — pick the closest page (tasks → `TaskManagement.jsx`, timesheets → `TimesheetManagement.jsx`).

## Roles (permission awareness)

| Role | Typical access |
|------|----------------|
| `staff` | Own tasks, time entries, timesheets, calendar |
| `admin` | Team timesheet review, reports, projects, tags, dept summary |
| `superuser` | User management, audit trail, timesheet feedback |

Dashboard switches on role in `src/pages/Dashboard.jsx`. Sidebar nav is role-specific in `Layout.jsx`. Backend enforces access in `requireAuth` handlers — **always check server-side rules**, not only UI hiding.

## API naming convention

- **Database / Prisma**: camelCase (`departmentId`, `fullName`)
- **JSON API / frontend payloads**: snake_case (`department_id`, `full_name`)
- Backend `serializeRecord` / `normalizeInput` handle conversion — do not mix conventions in one layer.

## Lint and typecheck scope

Before finishing, files you edit may need:

- `npm run lint` — `src/components/**`, `src/pages/**` only (not `src/lib/` or `src/components/ui/`)
- `npm run typecheck` — same paths via `jsconfig.json` (`checkJs: true`)

Use the `zero-problems` agent after substantive edits.

## Additional reference

For stack details, env vars, and deployment, see [architecture.md](architecture.md).
