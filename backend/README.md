# Khonofy Backend

## Base44 SDK

Install (already in `package.json`): `@base44/sdk`

Add to `backend/.env`:

```env
BASE44_APP_ID=your_app_id_here
BASE44_API_KEY=your_api_key_here
BASE44_APP_BASE_URL=https://your-app-name.base44.app
BASE44_SERVER_URL=https://base44.app
```

Use the **same** App ID and API key as in the frontend `.env.local` (`VITE_BASE44_*` variables).

Server client: `backend/src/lib/base44.js`

```javascript
import { createClient } from '@base44/sdk';

const base44 = createClient({
  appId: process.env.BASE44_APP_ID,
  headers: { api_key: process.env.BASE44_API_KEY },
  appBaseUrl: process.env.BASE44_APP_BASE_URL,
});
```

Health check: `GET http://localhost:3001/health/base44`

## Environment (local API — optional)

Create `backend/.env` with:

- `DATABASE_URL` - your PostgreSQL connection string
- `PORT=3001`
- `NODE_ENV=development`
- `FRONTEND_URL=http://localhost:5173`
- `JWT_SECRET` - any long random string
- `JWT_EXPIRES_IN=7d`

Optional email settings are supported for password reset logging:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`

## Run

From the repo root:

```bash
npm run dev
```

This starts:

- Frontend at `http://localhost:5173`
- Backend at `http://localhost:3001`

## Backend-only

```bash
cd backend
npm run dev
```

The backend prints its URL on startup.

## Demo accounts

After migrations, seed demo users:

```bash
cd backend
npm run db:migrate
npm run db:seed
```

| Role      | Name   | Email                 | Password  |
|-----------|--------|-----------------------|-----------|
| Superuser | Luis   | `luis@khonofy.local`  | `Demo123!` |
| Admin     | John   | `john@khonofy.local`  | `Demo123!` |
| Staff     | Nathii | `nathii@khonofy.local`| `Demo123!` |

Re-run `npm run db:seed` anytime to reset these passwords.

## Azure production (App Service)

The API runs at `khonofy-backend-api` on Linux App Service. Required settings:

| Setting | Value |
|---------|--------|
| `FRONTEND_URL` | `https://polite-smoke-0f9de4610.7.azurestaticapps.net` |
| `NODE_ENV` | `production` |
| **Startup command** | `npm start` (or `bash startup.sh`) |
| **Always On** | `true` |
| **App Service plan** | Basic (B1) or higher — Free (F1) stops when daily quota is exceeded |

Do **not** run `npm install` or `prisma db push` on every container start; that exceeds Azure's 230s startup timeout and returns 503 / browser CORS errors.

Database migrations: run `npx prisma migrate deploy` manually or in CI when schema changes — not on app boot.
