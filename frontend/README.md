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
  api/          Shared fetch client (base URL, JSON handling, error normalization)
  components/
    common/     Generic reusable UI (loading, error, error boundary)
    layout/     Application shell (header/nav/skip link + routed outlet)
  hooks/        Reusable hooks
  pages/        Routed top-level views
  types/        Shared TypeScript types (mirrors the backend's shared shapes, e.g. the error envelope)
  App.tsx       Route definitions
  main.tsx      Application entry point
tests/          Vitest + React Testing Library tests, mirroring src/
```

Employee listing, search/filter, salary, and analytics pages are added in
later feature commits on top of this foundation.
