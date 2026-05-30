# Khonofy Backend

## Environment

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
