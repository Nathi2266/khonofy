# Khonofy Implementation Examples

## Register a protected route

`src/App.jsx`:

```jsx
import MyPage from './pages/MyPage';

// Inside <Route element={<Layout />}>:
<Route path="/my-page" element={<MyPage />} />
```

## Minimal page skeleton

```jsx
import { useCurrentUser } from '@/hooks/useCurrentUser';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import PageLoader from '@/components/PageLoader';

export default function MyPage() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) return <PageLoader label="Loading..." />;
  if (!user) return null;

  return (
    <PageShell>
      <PageHeader title="My Page" />
      {/* content */}
    </PageShell>
  );
}
```

## Filter list by role

```jsx
const { data: user } = useCurrentUser();

const { data: tasks = [] } = useQuery({
  queryKey: ['tasks', user?.id, user?.role],
  queryFn: async () => {
    if (user.role === 'staff') {
      return base44.entities.Task.filter({ assigned_to: user.id });
    }
    return base44.entities.Task.list('-created_date', 200);
  },
  enabled: !!user,
});
```

## Extend base44 client

`src/api/base44Client.js`:

```js
const reports = {
  summary: (params) => request('/api/reports/summary', { query: params }),
};

export const base44 = {
  // ...existing
  reports,
};
```

## Backend: authenticated GET handler

```js
app.get('/api/reports/summary', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req.authUser) && !isSuperuser(req.authUser)) {
      return sendError(res, 403, 'Forbidden');
    }
    const rows = await prisma.task.findMany({ where: { /* ... */ } });
    return res.json(serializeMany('task', rows));
  } catch (error) {
    captureIfNeeded(error, req, { status: 500, route: '/api/reports/summary' });
    return sendError(res, 500, 'Failed to load summary');
  }
});
```

## Backend: PATCH with normalized input

```js
app.patch('/api/tasks/:id', requireAuth, async (req, res) => {
  const data = normalizeInput(req.body);
  // data is camelCase for Prisma after normalizeInput
  const updated = await prisma.task.update({
    where: { id: req.params.id },
    data,
  });
  return res.json(serializeRecord('task', updated));
});
```

## Invalidate related queries after timesheet change

Pattern from `TimesheetManagement.jsx`:

```js
queryClient.invalidateQueries({ queryKey: ['myTimesheets'] });
queryClient.invalidateQueries({ queryKey: ['weekEntries'] });
queryClient.invalidateQueries({ queryKey: ['teamTimesheets'] });
```

Grep the codebase for the entity you changed to find all related `queryKey` values.
