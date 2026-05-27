# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Is

A multi-module business platform with CRM, PIM (Product Information Management), OMS (Order Management), and WMS (Warehouse Management) modules. Built as a monorepo with a React frontend and Node.js/Express backend.

## Commands

### Server (`/server`)
```bash
npm run dev       # nodemon dev server (auto-reload)
npm start         # production server
npm run smoke     # smoke tests (scripts/smoke.js)
```

### Client (`/client`)
```bash
npm start         # React dev server on port 3000
npm run build     # production build
npm test          # Jest test runner
```

### Database (Sequelize CLI, run from `/server`)
```bash
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
npx sequelize-cli migration:generate --name my-migration
```

## Running Locally

**Docker (recommended):**
```bash
docker-compose -f docker-compose.dev.yml up   # API only, port 5001, live reload
docker-compose up                              # full stack: frontend (80), API (3000), Postgres, MongoDB
```

**Without Docker:**
- Start PostgreSQL and MongoDB locally
- Copy `.env.example` to `.env` in `/server` and fill in values
- `npm run dev` in `/server` (port 5000 by default)
- `npm start` in `/client` (port 3000, proxies API to `REACT_APP_API_URL`)

Set `SKIP_MONGO_CONNECT=1` to skip MongoDB (chat features disabled). Set `SKIP_CRON=1` to skip cron jobs.

## Architecture

### Stack
- **Frontend**: React 19, Redux Toolkit + RTK Query, Socket.IO client
- **Backend**: Express 5, Sequelize (PostgreSQL), Mongoose (MongoDB), Socket.IO
- **Auth**: JWT (access token 10m, refresh token 4h), email verification required

### Module Structure
Each business domain (crm, pim, oms, wms, system) is mirrored across:
- `server/src/models/<module>/` — Sequelize models
- `server/src/controllers/<module>/` — route handlers
- `server/src/services/<module>/` — business logic
- `server/src/routes/<module>/` — Express routers
- `client/src/pages/<Module>/` — React pages
- `client/src/store/rtk/<module>Api.js` — RTK Query API slices

### API & Middleware
REST API at `/api/*`. Middleware stack (in order): `requestContext` → `helmet` → `compression` → `rateLimit` (auth endpoints only) → `cors` → `auth` (JWT decode + permission load) → `companyIdGuard` → route handler.

All route handlers use `asyncHandler(controller)` wrapper. Error responses come from `server/src/middleware/errorHandler.js`.

### Authentication Flow
1. Register → verification email sent
2. Verify email → access + refresh tokens issued
3. Client stores refresh token in localStorage/sessionStorage, access token in Redux state
4. RTK Query `baseQueryWithReauth` (`client/src/store/rtk/sessionApi.js`) auto-refreshes on 401/408/419/440 using a mutex to prevent concurrent refresh races
5. Company context (`companyId`) is required for most endpoints; validated by `companyIdGuard` middleware

### Dual Database Pattern
- **PostgreSQL + Sequelize**: All relational data. Models auto-discovered recursively in `server/src/models/`. Associations defined via `model.associate()` called after all models load.
- **MongoDB + Mongoose**: Chat messages and chat-related documents. Models in `server/src/mongoModels/`. Connection is optional.

### Realtime
Two mechanisms run in parallel:
- **SSE** (`/api/sse`): Entity change events → RTK Query tag invalidations. Client: `client/src/store/rtk/realtime.js`
- **Socket.IO**: Chat rooms only. Server: `server/src/socket/chatSocket.js`

### File Handling
Files stored on filesystem (`FILES_STORAGE_ROOT`). Private files served via time-limited HMAC-signed URLs (`filesSigningService`). Public files via `/api/public-files/:publicKey`. Client hook: `client/src/hooks/useSignedFileUrl.js`.

### Frontend State
- **Auth slice**: `client/src/store/slices/authSlice.js` — tokens, user info
- **RTK Query APIs**: One file per domain in `client/src/store/rtk/` — 23 api files with tag-based cache invalidation
- **Bootstrap**: `client/src/store/slices/bootstrapSlice.js` — controls app init sequence (silent token refresh → SSE connect → render)

### Navigation / Menu
Menu items defined in `client/src/config/menu.js`. Routes in `client/src/App.js` with lazy-loaded pages and permission-gated route guards.

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `DB_HOST/PORT/NAME/USER/PASSWORD` | PostgreSQL |
| `MONGO_URI` or `MONGO_*` | MongoDB |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing |
| `APP_PUBLIC_URL` | Used in email links and file URLs |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `FILES_STORAGE_ROOT` | Filesystem path for uploaded files |
| `FILES_SIGNING_SECRET` | HMAC secret for signed URLs |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Nodemailer via Gmail |

## Conventions

- Controllers are thin — delegate to service layer. Services own business logic and direct DB access.
- New Sequelize models must implement a static `associate(models)` method if they have relations.
- RTK Query tag naming: use entity name as tag type (e.g., `'Counterparty'`, `'Product'`). Realtime SSE events map entity names to tag invalidations in `realtime.js`.
- i18n keys live in `client/src/i18n/locales/{en,pl,ru,ua}.json` — add keys to all four files.
- `requireMember` middleware (`server/src/middleware/requireMember.js`) enforces company membership and permission checks on protected routes.
