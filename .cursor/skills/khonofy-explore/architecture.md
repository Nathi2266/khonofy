# Khonofy Architecture Reference

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite 6, React Router 6, Tailwind CSS |
| UI | Radix UI + shadcn-style components in `src/components/ui/` |
| State / data | TanStack React Query, `AuthContext`, `LoadingContext` |
| Backend | Express on port 3001, Prisma + PostgreSQL |
| Auth | JWT (`backend/src/lib/auth.js`), Bearer token in `Authorization` header |
| Monitoring | Sentry (`src/lib/sentry-client.js`, backend Sentry in `index.js`) |
| Platform | Base44 entity config in `base44/` (optional cloud sync) |

## Dev setup

```bash
npm run dev          # frontend :5173 + backend :3001 (concurrently)
npm run dev:frontend # vite only
npm run dev:backend  # express only
```

Vite proxies `/api` → `http://localhost:3001` (`vite.config.js`).

Frontend API base: `VITE_API_URL` or `http://localhost:3001` (`base44Client.js`).

## Frontend structure

```
src/
├── App.jsx              # Routes, providers
├── main.jsx             # Entry
├── api/base44Client.js  # HTTP client (name is historical; talks to local Express)
├── components/          # Reusable UI (not pages)
│   ├── ui/              # Primitives — avoid editing unless necessary
│   ├── dashboard/       # Role-specific dashboard widgets
│   ├── calendar/        # Calendar + voice ticket
│   └── timesheets/      # Timesheet panels
├── hooks/               # useCurrentUser, useGlobalLoading, etc.
├── lib/                 # Auth, query client, utils (no ESLint)
├── pages/               # Route-level screens
└── utils/               # Helpers (activityLogger, entryTags)
```

Import alias: `@/` → `src/` (see `jsconfig.json`, `vite.config.js`).

## Backend structure

```
backend/
├── prisma/schema.prisma   # Models and enums
├── prisma/seed.js
└── src/
    ├── index.js           # All routes (~1700 lines)
    ├── config/env.js
    └── lib/
        ├── auth.js        # JWT, password hashing
        ├── prisma.js      # Prisma client
        ├── serialize.js   # snake_case ↔ camelCase
        ├── ai.js          # OpenAI assistant endpoints
        └── base44.js      # Optional Base44 SDK (health check)
```

## Entity resources

`RESOURCE_MAP` in `backend/src/index.js` maps URL segments to Prisma models:

| URL segment | Prisma model | Frontend accessor |
|-------------|--------------|-------------------|
| `users` | User | `base44.entities.User` |
| `tasks` | Task | `base44.entities.Task` |
| `time-entries` | TimeEntry | `base44.entities.TimeEntry` |
| `timesheets` | Timesheet | `base44.entities.Timesheet` |
| `departments` | Department | `base44.entities.Department` |
| `designations` | Designation | `base44.entities.Designation` |
| `clients` | Client | `base44.entities.Client` |
| `projects` | Project | `base44.entities.Project` |
| `tags` | Tag | `base44.entities.Tag` |
| `task-templates` | TaskTemplate | `base44.entities.TaskTemplate` |
| `activity-logs` | ActivityLog | `base44.entities.ActivityLog` |

Special routes: `/api/auth/*`, `/api/calendar/entries`, `/api/ai/*`, `/api/imagekit/auth`.

## Key enums (Prisma)

- `UserRole`: `superuser`, `admin`, `staff`
- `TaskPriority`: `low`, `medium`, `high`, `urgent`
- `TaskStatus`: `todo`, `in_progress`, `completed`, `blocked`
- `TimesheetStatus`: `draft`, `pending`, `approved`, `rejected`, `revoke_pending`

## Page layout pattern

Most authenticated pages use:

```jsx
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import SectionLoader from '@/components/SectionLoader';
import { useCurrentUser } from '@/hooks/useCurrentUser';
```

## Global loading

`base44Client.js` calls `beginRequest`/`endRequest` on the loading bus unless `showGlobalLoader: false`. Auth `me()` and some AI calls disable the global loader.

## CI / deploy

- `.github/workflows/ci.yml` — lint, typecheck, build
- `.github/workflows/deploy_khonofy-backend-api.yml` — backend deploy
