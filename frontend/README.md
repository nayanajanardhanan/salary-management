# PayScope Frontend

React + TypeScript SPA for PayScope, built with Vite. See
[`docs/architecture.md`](../docs/architecture.md) Section 5 for the frontend
architecture this structure follows.

## Requirements

- Node.js 20+
- The backend API running locally (see [`backend/README.md`](../backend) /
  repo root `README.md`) — this app has no data of its own.

## Setup

```bash
cd frontend
npm install
cp .env.example .env   # adjust VITE_API_BASE_URL if the backend isn't on localhost:8000
```

`VITE_API_BASE_URL` is resolved at **build** time, not read at runtime (see
`src/api/client.ts`): `npm run dev` falls back to `http://localhost:8000` on
its own if it's unset, but `npm run build` (and the Docker image build —
see [`docs/deployment.md`](../docs/deployment.md)) require it to be set
explicitly and fail loudly at runtime in the browser (a clear thrown error,
not a silently wrong URL) if it isn't. Set it in `.env` for `npm run build`,
or pass it as `--build-arg VITE_API_BASE_URL=...` when building the Docker
image.

## Authentication

The app requires signing in as an HR user before any employee, salary, or
analytics page is reachable — there is no manual access-token entry.

1. Make sure the backend has a development HR user (see
   [`backend/README.md`](../backend/README.md#seeding-an-hr-user) —
   `alembic upgrade head` then `python -m app.scripts.seed`, with
   `PAYSCOPE_HR_SEED_USERNAME` / `PAYSCOPE_HR_SEED_EMAIL` /
   `PAYSCOPE_HR_SEED_PASSWORD` set in `backend/.env`).
2. Open the app (`npm run dev`, default http://localhost:5173) — an
   unauthenticated visit to any page redirects to `/login`.
3. Sign in with that HR user's username (or email) and password. On
   success, the app stores the access token the backend returned (see
   [Security notes](#security-notes) below) and takes you to the page you
   originally requested, or the home page.
4. **Log out** via the "Sign out" button in the header (visible on every
   authenticated page). This clears the stored token immediately and
   returns you to `/login`; every protected page requires signing in again
   after that.

If a request is ever rejected as unauthorized (e.g. the token expired), the
app automatically returns to `/login` with a "session expired" message —
you don't need to manually sign out first.

### Security notes

The access token is stored in `sessionStorage` (`src/auth/authStore.ts`):
it is cleared automatically when the browser tab closes, and is never
persisted to `localStorage`, a cookie, or logged to the console. This is
simple and requires no backend session infrastructure, but — like any
browser-storage-based token — it is readable by any script that can run on
this origin (e.g. an XSS bug elsewhere in the app), and there is no
server-side revocation: an issued token stays valid until it expires
(`PAYSCOPE_JWT_EXPIRE_MINUTES`) even after sign-out or a tab close.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server (default: http://localhost:5173) |
| `npm run build` | Type-check (`tsc -b`) and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the Vitest test suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run lint` | Run ESLint |

## Structure

```
src/
  api/          Shared fetch client + auth/employees/analytics API calls
  auth/         Auth token storage and React auth context
  components/
    auth/       ProtectedRoute (router-level auth guard)
    common/     Generic reusable UI (loading, empty state, error, error boundary, confirm dialog)
    employee/   Employee table, search, filters, sort, pagination
    analytics/  Salary stat card and stats table
    layout/     Application shell (header/nav/skip link + routed outlet)
  hooks/        Data-fetching and mutation hooks, one per concern
  pages/        Routed top-level views: home, login, employee list/details/create,
                salary create/edit, analytics, not-found
  types/        Shared TypeScript types (mirrors the backend's shared shapes, e.g. the error envelope)
  App.tsx       Route definitions
  main.tsx      Application entry point
tests/          Cross-cutting Vitest + React Testing Library tests (api/auth/components/workflows);
                most pages and components also have a co-located *.test.tsx next to them in src/
```

See [`docs/architecture.md`](../docs/architecture.md) Section 5 for how these
pieces fit together (routing, state management, authentication state).
