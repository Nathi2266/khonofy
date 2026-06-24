---
name: khonofy-implement
description: >-
  Implements code changes in Khonofy following project conventions. Use when
  adding features, fixing bugs, creating pages, API endpoints, or modifying
  tasks/timesheets/calendar flows. Requires khonofy-explore first — read similar
  code before editing.
---

# Khonofy — Implement Changes

Apply after [khonofy-explore](../khonofy-explore/SKILL.md). Match existing code; smallest correct diff.

## Core rules

1. **Read before write** — open the closest existing page/endpoint and copy its structure.
2. **snake_case on the wire** — frontend forms and API bodies use `due_date`, `assigned_to`, `department_id`. Prisma uses camelCase.
3. **Do not bypass `base44Client`** — no raw `fetch('/api/...')` in pages; extend `base44` if needed.
4. **Invalidate React Query** after mutations — grep sibling pages for `queryKey` names.
5. **Role checks on backend** — UI hiding is not security; mirror checks in `backend/src/index.js`.
6. **Minimize scope** — no drive-by refactors, no new abstractions for one-off use.

## Adding a new page

1. Create `src/pages/MyFeature.jsx` using `PageShell` + `PageHeader`.
2. Register route in `src/App.jsx` inside `<ProtectedRoute>` → `<Layout>`.
3. If role-specific, add nav item to the right array in `Layout.jsx` (`STAFF_NAV`, `ADMIN_NAV`, or `SUPERUSER_NAV`).
4. Use `useCurrentUser()` for role and `user.id` scoping.

## Frontend data fetching pattern

```jsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const { data: user } = useCurrentUser();

const { data: items = [], isLoading } = useQuery({
  queryKey: ['myItems', user?.id],
  queryFn: () => base44.entities.Task.filter({ assigned_to: user.id }),
  enabled: !!user?.id,
});

const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: (payload) => base44.entities.Task.create(payload),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['myItems'] });
    toast({ title: 'Saved' });
  },
});
```

Entity methods: `list()`, `filter(query)`, `create(data)`, `update(id, data)`, `delete(id)`.

## Form payload pattern

Build payloads explicitly (see `TaskManagement.jsx` → `buildTaskPayload`):

- Trim strings; omit empty optional fields or set `null` on edit to clear.
- Date-only fields: `YYYY-MM-DD` strings.
- Denormalized name fields often travel with IDs (`project_id` + `project_name`).

## UI components

- Buttons, inputs, dialogs: `@/components/ui/*`
- Icons: `lucide-react`
- Toasts: `import { toast } from '@/components/ui/use-toast'`
- Loading: `PageLoader`, `SectionLoader`, or `LoadingOverlay`
- Do **not** edit `src/components/ui/` unless the task is specifically about primitives.

## Adding a backend endpoint

1. Find similar route in `backend/src/index.js`.
2. Use `requireAuth` middleware; use `req.authUser` for role checks.
3. Use `prisma.*` for DB; `serializeRecord` / `serializeMany` on responses.
4. Use `normalizeInput` on request bodies before Prisma writes.
5. Return `{ message }` for errors via `sendError(res, status, message)`.

### Adding a CRUD resource

If it fits `RESOURCE_MAP` pattern, add to:

- `RESOURCE_MAP` in `index.js`
- `schema.prisma` model
- `serialize.js` field sets if dates need special handling
- `base44.entities.*` in `base44Client.js`
- Optionally `base44/entities/*.jsonc`

Run `npx prisma migrate dev` from `backend/` when schema changes.

## Activity logging

User-visible actions often call `logActivity` from `@/utils/activityLogger` — grep an existing page for the event type string before inventing a new one.

## AI features

- Frontend: `base44.ai.chat`, `generateVoiceTicket`, `logTicket`, `scanUserImport`
- Backend: `backend/src/lib/ai.js`
- UI: `src/pages/AIAssistant.jsx`, `src/components/calendar/VoiceTicketDialog.jsx`

## Verification before done

```bash
npm run lint
npm run typecheck
```

Manually test the affected route if feasible. Invoke `zero-problems` agent if diagnostics remain.

## Anti-patterns

| Avoid | Do instead |
|-------|------------|
| `@base44/sdk` in frontend pages | `base44` from `@/api/base44Client` |
| camelCase in API JSON | snake_case payloads |
| New global state library | React Query + existing contexts |
| Editing `eslint.config.js` to pass lint | Fix the code |
| Blanket `eslint-disable` | Fix or narrow exception with comment |
| Secrets in code | `.env.local` / `backend/.env` |

## Examples

See [examples.md](examples.md) for copy-paste patterns for routes, mutations, and backend handlers.
