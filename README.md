# Khonofy

Time and task tracking app powered by [Base44](https://base44.com).

## Prerequisites

1. Clone the repo and run `npm install` (root — includes `@base44/sdk`).
2. Copy env templates and add your Base44 credentials from the Base44 app dashboard.

## Environment variables

### Frontend — `.env.local` (project root)

Create `.env.local` in the project root:

```env
VITE_BASE44_APP_ID=your_app_id_here
VITE_BASE44_API_KEY=your_api_key_here
VITE_BASE44_APP_BASE_URL=https://your-app-name.base44.app
VITE_BASE44_SERVER_URL=https://base44.app
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_BASE44_APP_ID` | Yes | App ID from Base44 |
| `VITE_BASE44_API_KEY` | Yes | API key from Base44 (sent as `api_key` header) |
| `VITE_BASE44_APP_BASE_URL` | Recommended | Your app URL on Base44 (used for auth redirects) |
| `VITE_BASE44_SERVER_URL` | No | Defaults to `https://base44.app` |

See `.env.local.example` for a copy-paste template.

### Backend — `backend/.env`

Add these lines to `backend/.env` (same values as the frontend, **without** the `VITE_` prefix):

```env
BASE44_APP_ID=your_app_id_here
BASE44_API_KEY=your_api_key_here
BASE44_APP_BASE_URL=https://your-app-name.base44.app
BASE44_SERVER_URL=https://base44.app
```

| Variable | Required | Description |
|----------|----------|-------------|
| `BASE44_APP_ID` | Yes | Same as `VITE_BASE44_APP_ID` |
| `BASE44_API_KEY` | Yes | Same as `VITE_BASE44_API_KEY` |
| `BASE44_APP_BASE_URL` | Recommended | Same as `VITE_BASE44_APP_BASE_URL` |
| `BASE44_SERVER_URL` | No | Defaults to `https://base44.app` |

The backend initializes the SDK in `backend/src/lib/base44.js`. Check connectivity:

```bash
curl http://localhost:3001/health/base44
```

Keep existing `DATABASE_URL`, `JWT_SECRET`, etc. in `backend/.env` only if you still use the local Express/Prisma API.

## Run locally

```bash
npm run dev
```

- Frontend: Vite (usually `http://localhost:5173`)
- Backend: optional Express server on `http://localhost:3001`

The React app uses `@base44/sdk` via `src/api/base44Client.js`:

```javascript
import { createClient } from '@base44/sdk';

const base44 = createClient({
  appId: import.meta.env.VITE_BASE44_APP_ID,
  headers: { api_key: import.meta.env.VITE_BASE44_API_KEY },
  appBaseUrl: import.meta.env.VITE_BASE44_APP_BASE_URL,
});
```


## Release flow

Khonofy uses a staged GitHub Actions release pipeline:

```text
feature branch -> CI -> deploy branch -> Azure deploys -> PR to main
```

### What happens on a feature push
- CI runs lint, typecheck, build, and dist verification
- The branch is promoted into `deploy`
- Version files are bumped on `deploy`
- Frontend and/or backend deploy workflows run when relevant files change
- A PR from `deploy` to `main` is opened for manual final promotion

## Docs

- [Base44 + GitHub](https://docs.base44.com/Integrations/Using-GitHub)
- [Base44 support](https://app.base44.com/support)
